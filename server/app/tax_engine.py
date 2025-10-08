from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Optional

# -----------------------------
# Data models
# -----------------------------
@dataclass
class TaxProfile:
    filing_status: str
    federal_st_rate: float
    federal_lt_rate: float
    state_code: str
    state_st_rate: float
    state_lt_rate: float
    niit_rate: float = 0.0
    carry_forward_losses: float = 0.0

    @property
    def total_st_rate(self) -> float:
        return self.federal_st_rate + self.state_st_rate + self.niit_rate

    @property
    def total_lt_rate(self) -> float:
        return self.federal_lt_rate + self.state_lt_rate + self.niit_rate


@dataclass
class Lot:
    symbol: str
    quantity: float
    cost_per_share: float
    purchase_date: date
    account: Optional[str] = None


@dataclass
class LotResult:
    symbol: str
    quantity: float
    price: float
    cost_per_share: float
    purchase_date: date
    holding_days: int
    term: str  # "long" or "short"
    unrealized_gain: float
    est_tax_liability: float
    after_tax_value: float
    est_tax_savings: float
    days_to_lt: int


# -----------------------------
# Helpers
# -----------------------------
def is_long_term(purchase_date: date, today: Optional[date] = None) -> bool:
    """
    Long-term threshold is holding period > 365 days (>= 366 days).
    """
    today = today or date.today()
    return (today - purchase_date).days >= 366


LT_DAYS = 365


def days_to_lt(purchase_date: date, asof: Optional[date] = None) -> int:
    """
    Days remaining until the position becomes long-term (365-day threshold).
    If already long-term, returns 0.
    """
    asof = asof or date.today()
    delta = (purchase_date + timedelta(days=LT_DAYS)) - asof
    return max(0, delta.days)


# -----------------------------
# Core computation
# -----------------------------
def estimate_lot(lot: Lot, price: float, profile: TaxProfile, today: Optional[date] = None) -> LotResult:
    today = today or date.today()

    holding_days = (today - lot.purchase_date).days
    long_term = is_long_term(lot.purchase_date, today)
    term_str = "long" if long_term else "short"

    gain = (price - lot.cost_per_share) * lot.quantity
    rate = profile.total_lt_rate if long_term else profile.total_st_rate

    est_tax = gain * rate if gain > 0 else 0.0
    est_savings = (-gain) * rate if gain < 0 else 0.0
    after_tax_value = price * lot.quantity - est_tax

    d2lt = 0 if long_term else days_to_lt(lot.purchase_date, asof=today)

    return LotResult(
        symbol=lot.symbol,
        quantity=lot.quantity,
        price=price,
        cost_per_share=lot.cost_per_share,
        purchase_date=lot.purchase_date,
        holding_days=holding_days,
        term=term_str,
        unrealized_gain=gain,
        est_tax_liability=est_tax,
        after_tax_value=after_tax_value,
        est_tax_savings=est_savings,
        days_to_lt=d2lt,
    )


# -----------------------------
# Portfolio summary
# -----------------------------
@dataclass
class PortfolioSummary:
    pre_tax_value: float
    total_unrealized_gain: float
    gross_tax_on_gains: float
    gross_potential_savings_on_losses: float
    naive_net_tax_if_liquidated_now: float
    after_tax_value_if_liquidated_now: float


def summarize(results: List[LotResult]) -> PortfolioSummary:
    pre = sum(r.price * r.quantity for r in results)
    ug = sum(r.unrealized_gain for r in results)
    tax_gross = sum(r.est_tax_liability for r in results)
    sav_gross = sum(r.est_tax_savings for r in results)
    net_tax = max(tax_gross - sav_gross, 0.0)
    return PortfolioSummary(
        pre_tax_value=pre,
        total_unrealized_gain=ug,
        gross_tax_on_gains=tax_gross,
        gross_potential_savings_on_losses=sav_gross,
        naive_net_tax_if_liquidated_now=net_tax,
        after_tax_value_if_liquidated_now=pre - net_tax,
    )
