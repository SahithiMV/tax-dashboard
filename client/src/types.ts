// client/src/types.ts
export type LotResult = {
    symbol: string;
    quantity: number;
    price: number;
    cost_per_share: number;
    purchase_date: string; // ISO
    holding_days: number;
    term: "long" | "short";
    unrealized_gain: number;
    est_tax_liability: number;
    after_tax_value: number;
    est_tax_savings: number;
    days_to_lt: number;
  };

  // ---- Tax profile ----
  export type TaxProfileIn = {
    filing_status: "single" | "married_joint" | "married_separate" | "head";
    federal_st_rate: number;
    federal_lt_rate: number;
    state_code: string;
    state_st_rate: number;
    state_lt_rate: number;
    niit_rate: number;
    carry_forward_losses: number;
  };

  export type Summary = {
    pre_tax_value: number;
    total_unrealized_gain: number;
    gross_tax_on_gains: number;
    gross_potential_savings_on_losses: number;
    naive_net_tax_if_liquidated_now: number;
    after_tax_value_if_liquidated_now: number;
  };
  
  export type WhatIfSell = {
    symbol: string;
    sell_quantity: number;
    asof_price: number;
    realized_gain: number;
    est_tax: number;
    lots_consumed: { lot_id: number | null; qty_used: number; term: "lt" | "st"; realized_gain: number; est_tax: number }[];
  };
  
  export type HarvestCandidate = {
    symbol: string;
    lot_id: number | null;
    purchase_date: string;
    quantity: number;
    cost_per_share: number;
    price: number;
    unrealized_loss: number;
    days_to_lt: number;
  };
  
export type TokenOut = { access_token: string; token_type: "bearer" };
export type Me = { id: number; email: string };
