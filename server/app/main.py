# server/app/main.py
import io, csv, os
from datetime import date
from typing import List, Dict

from fastapi import FastAPI, UploadFile, HTTPException, Query, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import TaxProfileIn, QuoteUpsert
from app.tax_engine import TaxProfile, Lot, estimate_lot, summarize, days_to_lt
from app.db import User, TaxProfileDB, LotDB
from app.quotes import get_quotes

# Import auth helpers; alias to the names this file expects
from app.auth import (
    get_db,
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)

app = FastAPI(title="Tax-Aware Portfolio API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://yourapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Helpers
# -----------------------
def _load_profile(db: Session, user_id: int) -> TaxProfile:
    tp: TaxProfileDB | None = (
        db.query(TaxProfileDB).filter(TaxProfileDB.user_id == user_id).first()
    )
    if not tp:
        raise HTTPException(
            status_code=404, detail="No tax profile set"
        )
    return TaxProfile(
        filing_status=tp.filing_status,
        federal_st_rate=float(tp.federal_st_rate),
        federal_lt_rate=float(tp.federal_lt_rate),
        state_code=tp.state_code,
        state_st_rate=float(tp.state_st_rate),
        state_lt_rate=float(tp.state_lt_rate),
        niit_rate=float(tp.niit_rate or 0.0),
        carry_forward_losses=float(tp.carry_forward_losses or 0.0),
    )

# -----------------------
# AUTH ROUTES (public)
# -----------------------
class SignupIn(BaseModel):
    email: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

@app.post("/api/auth/signup", response_model=TokenOut)
def signup(payload: SignupIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=email, password_hash=get_password_hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token)

@app.post("/api/auth/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm passes fields: username, password
    email = form.username.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token)

@app.get("/api/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}

# -----------------------
# Debug / Health
# -----------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/api/debug/db")
def debug_db(db: Session = Depends(get_db)):
    url = os.getenv("DATABASE_URL", "")
    # redact password if present
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        if "@" in rest:
            _, host = rest.split("@", 1)
            url = f"{scheme}://***:***@{host}"
    users = db.execute(text("select count(*) from users")).scalar() or 0
    profiles = db.execute(text("select count(*) from tax_profiles")).scalar() or 0
    lots = db.execute(text("select count(*) from lots")).scalar() or 0
    return {"db": url, "counts": {"users": users, "tax_profiles": profiles, "lots": lots}}

# -----------------------
# Quotes (stub or yfinance via adapter)
# -----------------------
MEM_QUOTES: Dict[str, float] = {}

@app.put("/api/quotes")
def upsert_quotes(body: QuoteUpsert):
    """Public for convenience; can protect later."""
    global MEM_QUOTES
    MEM_QUOTES.update(body.root)
    return {"symbols": sorted(MEM_QUOTES.keys())}

@app.get("/api/quotes")
def api_quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    out = get_quotes(syms, MEM_QUOTES)
    return JSONResponse(content=jsonable_encoder(out))

# -----------------------
# Tax profile (protected)
# -----------------------
@app.put("/api/tax_profile")
def put_tax_profile(
    p: TaxProfileIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tp = db.query(TaxProfileDB).filter(TaxProfileDB.user_id == current_user.id).first()
    if not tp:
        tp = TaxProfileDB(user_id=current_user.id, **p.model_dump())
        db.add(tp)
    else:
        for k, v in p.model_dump().items():
            setattr(tp, k, v)
    db.commit()
    return {"ok": True}

@app.get("/api/tax_profile")
def get_tax_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tp = db.query(TaxProfileDB).filter(TaxProfileDB.user_id == current_user.id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="No tax profile set")
    return {
        "filing_status": tp.filing_status,
        "federal_st_rate": float(tp.federal_st_rate),
        "federal_lt_rate": float(tp.federal_lt_rate),
        "state_code": tp.state_code,
        "state_st_rate": float(tp.state_st_rate),
        "state_lt_rate": float(tp.state_lt_rate),
        "niit_rate": float(tp.niit_rate or 0.0),
        "carry_forward_losses": float(tp.carry_forward_losses or 0.0),
    }

# -----------------------
# Import holdings CSV (protected, per-user)
# -----------------------
@app.post("/api/import/csv")
async def import_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()
    reader = csv.DictReader(io.StringIO(data.decode()))
    n = 0
    for r in reader:
        db.add(
            LotDB(
                user_id=current_user.id,
                symbol=r["symbol"].upper(),
                quantity=float(r["quantity"]),
                cost_per_share=float(r["cost_per_share"]),
                purchase_date=date.fromisoformat(r["purchase_date"]),
                account=(r.get("account") or None),
            )
        )
        n += 1
    db.commit()
    return {"lots": n}

# -----------------------
# Holdings & Summary (protected)
# -----------------------
@app.get("/api/holdings")
def api_holdings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _load_profile(db, user_id=current_user.id)
    rows = db.query(LotDB).filter(LotDB.user_id == current_user.id).all()
    symbols = sorted({r.symbol for r in rows})
    prices = get_quotes(symbols, MEM_QUOTES)

    out: List[dict] = []
    for r in rows:
        price = prices.get(r.symbol)
        if price is None:
            continue
        lot = Lot(
            symbol=r.symbol,
            quantity=float(r.quantity),
            cost_per_share=float(r.cost_per_share),
            purchase_date=r.purchase_date,
            account=r.account,
        )
        out.append(estimate_lot(lot, price, profile).__dict__)
    return JSONResponse(content=jsonable_encoder(out))

@app.get("/api/portfolio/summary")
def api_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _load_profile(db, user_id=current_user.id)
    rows = db.query(LotDB).filter(LotDB.user_id == current_user.id).all()
    symbols = sorted({r.symbol for r in rows})
    prices = get_quotes(symbols, MEM_QUOTES)

    est = []
    for r in rows:
        price = prices.get(r.symbol)
        if price is None:
            continue
        lot = Lot(
            symbol=r.symbol,
            quantity=float(r.quantity),
            cost_per_share=float(r.cost_per_share),
            purchase_date=r.purchase_date,
            account=r.account,
        )
        est.append(estimate_lot(lot, price, profile))
    s = summarize(est)
    return JSONResponse(content=jsonable_encoder(s.__dict__))

# -----------------------
# What-if & Harvest (protected)
# -----------------------
class WhatIfOut(BaseModel):
    symbol: str
    sell_quantity: float
    asof_price: float
    realized_gain: float
    est_tax: float
    lots_consumed: list[dict]  # [{lot_id, qty_used, term, realized_gain, est_tax}]

def _pick_fifo_lots(lots, symbol, qty):
    """Yield (lot, qty_used) for the given symbol until qty is satisfied."""
    remaining = qty
    for l in sorted((x for x in lots if x.symbol == symbol), key=lambda x: x.purchase_date):
        if remaining <= 0:
            break
        use = min(remaining, l.quantity)
        yield l, use
        remaining -= use

@app.get("/api/whatif/sell", response_model=WhatIfOut)
def whatif_sell(
    symbol: str = Query(..., min_length=1),
    quantity: float = Query(..., gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _load_profile(db, user_id=current_user.id)
    symbol = symbol.upper()
    lots = db.query(LotDB).filter(LotDB.user_id == current_user.id, LotDB.symbol == symbol).all()
    if not lots:
        raise HTTPException(404, f"No lots for {symbol}")

    prices = get_quotes([symbol], MEM_QUOTES)
    price = prices.get(symbol)
    if price is None:
        raise HTTPException(400, f"No price for {symbol}")

    realized_gain = 0.0
    est_tax = 0.0
    details = []
    consumed = 0.0
    for lot, use in _pick_fifo_lots(lots, symbol, quantity):
        if use <= 0:
            break
        basis = lot.cost_per_share
        gain = (price - basis) * use
        term = "lt" if (date.today() - lot.purchase_date).days > 365 else "st"
        if gain > 0:
            if term == "lt":
                tax = gain * (profile.federal_lt_rate + profile.state_lt_rate + profile.niit_rate)
            else:
                tax = gain * (profile.federal_st_rate + profile.state_st_rate + profile.niit_rate)
        else:
            tax = 0.0

        realized_gain += gain
        est_tax += tax
        consumed += use
        details.append({
            "lot_id": lot.id if hasattr(lot, "id") else None,
            "qty_used": use,
            "term": term,
            "realized_gain": round(gain, 2),
            "est_tax": round(tax, 2),
        })

        if consumed >= quantity:
            break

    if consumed < quantity:
        raise HTTPException(400, f"Requested {quantity} exceeds available {consumed} shares for {symbol}")

    return WhatIfOut(
        symbol=symbol,
        sell_quantity=quantity,
        asof_price=round(price, 4),
        realized_gain=round(realized_gain, 2),
        est_tax=round(est_tax, 2),
        lots_consumed=details,
    )

class HarvestCandidate(BaseModel):
    symbol: str
    lot_id: int | None
    purchase_date: str
    quantity: float
    cost_per_share: float
    price: float
    unrealized_loss: float
    days_to_lt: int

@app.get("/api/harvest/candidates", response_model=list[HarvestCandidate])
def harvest_candidates(
    limit: int = Query(10, ge=1, le=100),
    min_loss: float = Query(50.0, ge=0.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = _load_profile(db, user_id=current_user.id)  # Ensures profile exists
    lots = db.query(LotDB).filter(LotDB.user_id == current_user.id).all()
    symbols = list({l.symbol for l in lots})
    prices = get_quotes(symbols, MEM_QUOTES)

    rows: list[HarvestCandidate] = []
    for l in lots:
        price = prices.get(l.symbol)
        if price is None:
            continue
        loss = (price - l.cost_per_share) * l.quantity
        if loss >= 0:
            continue
        d2lt = days_to_lt(l.purchase_date)
        rows.append(HarvestCandidate(
            symbol=l.symbol,
            lot_id=l.id if hasattr(l, "id") else None,
            purchase_date=l.purchase_date.isoformat(),
            quantity=float(l.quantity),
            cost_per_share=float(l.cost_per_share),
            price=float(price),
            unrealized_loss=round(-loss, 2),  # positive number
            days_to_lt=d2lt,
        ))

    rows.sort(key=lambda r: r.unrealized_loss, reverse=True)
    rows = [r for r in rows if r.unrealized_loss >= min_loss][:limit]
    return rows
