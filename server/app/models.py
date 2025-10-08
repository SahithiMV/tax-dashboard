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

class LotIn(BaseModel):
    symbol: str
    quantity: float
    cost_per_share: float
    purchase_date: str  # YYYY-MM-DD
    account: Optional[str] = None

# Pydantic v2 root model for a dict of quotes
class QuoteUpsert(RootModel[Dict[str, float]]):
    pass
