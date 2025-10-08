import json, csv, sys
from pathlib import Path
from datetime import date
from tabulate import tabulate

# Ensure 'server' is on sys.path when running this file directly
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.tax_engine import TaxProfile, Lot, estimate_lot, summarize

# Edit these prices as you like (we'll add live quotes later)
PRICES = {
    "AAPL": 230.10,
    "NVDA": 112.40,
    "TSLA": 240.50,
    "MSFT": 420.75,
    "AMZN": 181.22,
}

def load_profile(path=ROOT/"data/tax_profile.example.json") -> TaxProfile:
    with open(path) as f:
        p = json.load(f)
    return TaxProfile(**p)

def load_lots(path=ROOT/"data/holdings.example.csv"):
    lots = []
    with open(path) as f:
        for r in csv.DictReader(f):
            lots.append(Lot(
                symbol=r["symbol"],
                quantity=float(r["quantity"]),
                cost_per_share=float(r["cost_per_share"]),
                purchase_date=date.fromisoformat(r["purchase_date"]),
                account=r.get("account") or None
            ))
    return lots

def main():
    profile = load_profile()
    lots = load_lots()
    rows = []
    for lot in lots:
        price = PRICES.get(lot.symbol)
        if price is None:
            continue
        res = estimate_lot(lot, price, profile)
        rows.append(res)

    table = [[
        r.symbol, r.quantity, f"{r.cost_per_share:.2f}", f"{r.price:.2f}",
        r.holding_days, r.term.upper(),
        f"{r.unrealized_gain:,.2f}", f"{r.est_tax_liability:,.2f}", f"{r.after_tax_value:,.2f}"
    ] for r in rows]

    print(tabulate(table,
        headers=["Symbol","Qty","Cost","Price","Days","Term","Unrealized","Est. Tax","After-Tax"],
        tablefmt="github"
    ))

    s = summarize(rows)
    print("\nSummary:")
    print(f"Pre-tax value: ${s.pre_tax_value:,.2f}")
    print(f"Total unrealized P/L: ${s.total_unrealized_gain:,.2f}")
    print(f"Gross tax on gains: ${s.gross_tax_on_gains:,.2f}")
    print(f"Gross potential savings from losses: ${s.gross_potential_savings_on_losses:,.2f}")
    print(f"Naive net tax if liquidated now: ${s.naive_net_tax_if_liquidated_now:,.2f}")
    print(f"After-tax value if liquidated now: ${s.after_tax_value_if_liquidated_now:,.2f}")

    print("\nNote: These are estimates only and not tax advice.")

if __name__ == "__main__":
    main()
