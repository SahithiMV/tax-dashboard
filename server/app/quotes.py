import os
from typing import Dict, List

# QUOTES_SOURCE controls where prices come from:
#   "stub"     -> use the in-memory map set via PUT /api/quotes
#   "yfinance" -> fetch last available price from Yahoo
SOURCE = os.getenv("QUOTES_SOURCE", "stub").lower()

def get_quotes_stub(symbols: List[str], mem_quotes: Dict[str, float]) -> Dict[str, float]:
    return {s: mem_quotes.get(s) for s in symbols}

def get_quotes_yfinance(symbols: List[str]) -> Dict[str, float]:
    # lazy import so users without yfinance don't need dependency
    import yfinance as yf
    import pandas as pd

    if not symbols:
        return {}

    # yfinance download: returns a DataFrame; normalize to a dict of last close per symbol
    tickers = " ".join(symbols)
    df = yf.download(tickers=tickers, period="1d", interval="1m", group_by="ticker", progress=False)

    out: Dict[str, float] = {}

    # multi-ticker -> columns by ticker; single-ticker -> plain columns
    if "Close" in df:  # single ticker structure
        last = float(df["Close"].dropna().iloc[-1])
        out[symbols[0]] = last
        return out

    # multi-ticker structure: df[ticker]["Close"]
    for s in symbols:
        try:
            ser = df[(s, "Close")].dropna()
            if not ser.empty:
                out[s] = float(ser.iloc[-1])
        except Exception:
            # if symbol not found, skip it; caller can handle None
            pass
    return out

def get_quotes(symbols: List[str], mem_quotes: Dict[str, float]) -> Dict[str, float]:
    if SOURCE == "stub":
        return get_quotes_stub(symbols, mem_quotes)
    elif SOURCE == "yfinance":
        return get_quotes_yfinance(symbols)
    else:
        raise ValueError(f"Unknown QUOTES_SOURCE: {SOURCE}")
