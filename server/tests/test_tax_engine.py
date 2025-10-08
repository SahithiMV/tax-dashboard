from datetime import date, timedelta
from app.tax_engine import TaxProfile, Lot, estimate_lot, summarize, is_long_term

PROFILE = TaxProfile("single",0.37,0.15,"CA",0.093,0.093,0.0,0.0)

def test_boundary_term():
    d_short = date.today() - timedelta(days=365)
    d_long  = date.today() - timedelta(days=366)
    assert is_long_term(d_short) is False
    assert is_long_term(d_long) is True

def test_gain_and_loss():
    lot_gain = Lot("AAA", 10, 100.0, date(2023,1,1))
    r = estimate_lot(lot_gain, price=150.0, profile=PROFILE, today=date(2025,1,2))
    assert r.unrealized_gain == 500.0
    assert r.est_tax_liability > 0
    lot_loss = Lot("BBB", 10, 100.0, date(2023,1,1))
    r2 = estimate_lot(lot_loss, price=80.0, profile=PROFILE, today=date(2025,1,2))
    assert r2.unrealized_gain == -200.0
    assert r2.est_tax_liability == 0
    assert r2.est_tax_savings > 0

def test_summary():
    from app.tax_engine import LotResult
    r = summarize([
        estimate_lot(Lot("AAA",1,100,date(2023,1,1)),120,PROFILE,date(2025,1,2)),
        estimate_lot(Lot("BBB",1,200,date(2023,1,1)),180,PROFILE,date(2025,1,2)),
    ])
    assert r.pre_tax_value > 0
    assert r.after_tax_value_if_liquidated_now <= r.pre_tax_value
