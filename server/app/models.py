from pydantic import BaseModel, RootModel
from typing import Optional, List, Dict

class TaxProfileIn(BaseModel):
    filing_status: str
    federal_st_rate: float
    federal_lt_rate: float
    state_code: str
    state_st_rate: float
    state_lt_rate: float
    niit_rate: float = 0.0
    carry_forward_losses: float = 0.0
    
class TaxProfileEstimateIn(BaseModel):
    filing_status: Optional[str] = None  # "single", "married_joint", etc.
    state_code: Optional[str] = None     # "CA", "NY", ...
    income_band: Optional[str] = None    # "<50k", "50-100k", "100-200k", "200-500k", ">500k"
    trading_style: Optional[str] = None  # "long_term", "short_term", "mixed"
    carry_forward_losses: Optional[float] = 0.0
    extra_notes: Optional[str] = None    # optional free text
    
class TaxProfileEstimateOut(BaseModel):
    tax_profile: TaxProfileIn
    explanation: str

class LotIn(BaseModel):
    symbol: str
    quantity: float
    cost_per_share: float
    purchase_date: str  # YYYY-MM-DD
    account: Optional[str] = None

# Pydantic v2 root model for a dict of quotes
class QuoteUpsert(RootModel[Dict[str, float]]):
    pass
