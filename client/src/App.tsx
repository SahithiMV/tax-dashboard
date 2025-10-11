import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  api,
  signup,
  login,
  me,
  getHoldings,
  getSummary,
  getHarvestCandidates,
  whatIfSell,
} from "./api";
import type { HarvestCandidate, LotResult, Summary, WhatIfSell } from "./types";
import { isAxiosError } from "axios";

/** local shape for the tax profile form */
type FilingStatus = "single" | "married_joint" | "married_separate" | "head";
type TaxProfileIn = {
  filing_status: FilingStatus;
  federal_st_rate: number;
  federal_lt_rate: number;
  state_code: string;
  state_st_rate: number;
  state_lt_rate: number;
  niit_rate: number;
  carry_forward_losses: number;
};

const defaultProfile: TaxProfileIn = {
  filing_status: "single",
  federal_st_rate: 0.37,
  federal_lt_rate: 0.15,
  state_code: "CA",
  state_st_rate: 0.093,
  state_lt_rate: 0.093,
  niit_rate: 0,
  carry_forward_losses: 0,
};

function fmt(n?: number, p = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p });
}

export default function App() {
  // auth
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const authed = !!userEmail;

  // profile
  const [profile, setProfile] = useState<TaxProfileIn>(defaultProfile);
  const [profMsg, setProfMsg] = useState<string>("");

  // data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lots, setLots] = useState<LotResult[]>([]);
  const [harvest, setHarvest] = useState<HarvestCandidate[]>([]);
  const [what, setWhat] = useState<WhatIfSell | null>(null);

  // UI state
  const [busy, setBusy] = useState(false);
  const [netErr, setNetErr] = useState<string | null>(null);

  useEffect(() => {
    // try to fetch /api/me if token exists (interceptor adds Authorization)
    me()
      .then((m) => setUserEmail(m.email))
      .catch(() => setUserEmail(null));
  }, []);

  const loadAll = async () => {
    setBusy(true);
    setNetErr(null);
    try {
      const [s, h, c] = await Promise.all([
        getSummary(),
        getHoldings(),
        getHarvestCandidates(10, 50),
      ]);
      setSummary(s);
      setLots(h);
      setHarvest(c);
    } catch (e) {
      setNetErr(isAxiosError(e) ? (e.response?.data?.detail || e.message) : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setDemoQuotes = async () => {
    // simple demo quotes you used before
    await api.put("/api/quotes", { AAPL: 258.03, NVDA: 189.07, TSLA: 438.6, MSFT: 524.9, AMZN: 225.2 });
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setNetErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post("/api/import/csv", fd);
      await loadAll();
    } catch (e) {
      setNetErr(isAxiosError(e) ? (e.response?.data?.detail || e.message) : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveProfile = async () => {
    setBusy(true);
    setProfMsg("");
    setNetErr(null);
    try {
      await api.put("/api/tax_profile", profile);
      setProfMsg("Saved ✓");
    } catch (e) {
      setProfMsg("");
      setNetErr(isAxiosError(e) ? (e.response?.data?.detail || e.message) : String(e));
    } finally {
      setBusy(false);
    }
  };

  const authError = (e: unknown) =>
    isAxiosError(e) ? (e.response?.data?.detail || e.message) : String(e);

  const doSignup = async () => {
    setBusy(true);
    setNetErr(null);
    try {
      await signup(email, pw);
      const m = await me();
      setUserEmail(m.email);
      setEmail(""); setPw("");
    } catch (e) {
      setNetErr(authError(e));
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    setBusy(true);
    setNetErr(null);
    try {
      await login(email, pw);
      const m = await me();
      setUserEmail(m.email);
      setEmail(""); setPw("");
    } catch (e) {
      setNetErr(authError(e));
    } finally {
      setBusy(false);
    }
  };

  const doLogout = () => {
    // simplest: clear token storage by removing Authorization header at source
    localStorage.removeItem("taxdash_token");
    setUserEmail(null);
    setSummary(null);
    setLots([]);
    setHarvest([]);
    setWhat(null);
  };

  // What-if inputs
  const [sym, setSym] = useState("AAPL");
  const [qty, setQty] = useState(5);

  const runWhatIf = async () => {
    setBusy(true);
    setNetErr(null);
    try {
      const res = await whatIfSell(sym, qty);
      setWhat(res);
    } catch (e) {
      setNetErr(isAxiosError(e) ? (e.response?.data?.detail || e.message) : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canLoad = authed;

  return (
    <div className="app">
      {/* top bar */}
      <div className="topbar">
        <div className="brand">🧮 Tax-Aware Portfolio (MVP)</div>
        <div className="auth">
          {authed ? (
            <>
              <span className="authtag">Signed in: {userEmail}</span>
              <button className="btn" onClick={doLogout}>Logout</button>
              <button className="btn" disabled={busy} onClick={loadAll}>Refresh</button>
            </>
          ) : (
            <>
              <input
                className="input medium"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input medium"
                placeholder="password"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <button className="btn primary" disabled={busy} onClick={doSignup}>Sign up</button>
              <button className="btn" disabled={busy} onClick={doLogin}>Log in</button>
            </>
          )}
        </div>
      </div>

      {!authed && (
        <div className="section">
          <h3 className="section-title">How to use</h3>
          <div className="stack-sm">
            <div>1. Sign up or log in.</div>
            <div>2. Save your tax profile.</div>
            <div>3. Import your holdings CSV and click <b>Set demo quotes</b>.</div>
            <div>4. View summary & holdings, harvest ideas, and run a what-if sell.</div>
          </div>
        </div>
      )}

      {netErr && <div className="section banner">{netErr}</div>}

      {/* Tax profile */}
      <section className="section">
        <div className="spread">
          <h3 className="section-title">1. Tax profile</h3>
          {authed && <span className="chip">{profMsg || " "}</span>}
        </div>

        <div className="row" style={{marginBottom:12}}>
          <label className="inline">
            Filing status
            <select
              className="select"
              value={profile.filing_status}
              onChange={(e) => setProfile(p => ({ ...p, filing_status: e.target.value as FilingStatus }))}
            >
              <option value="single">single</option>
              <option value="married_joint">married_joint</option>
              <option value="married_separate">married_separate</option>
              <option value="head">head</option>
            </select>
          </label>

          <label className="inline">State code
            <input className="input small" value={profile.state_code}
              onChange={(e)=>setProfile(p=>({...p, state_code:e.target.value.toUpperCase().slice(0,2)}))}/>
          </label>

          <label className="inline">Fed ST rate
            <input className="input small" type="number" step="0.001"
              value={profile.federal_st_rate}
              onChange={(e)=>setProfile(p=>({...p, federal_st_rate:+e.target.value}))}/>
          </label>

          <label className="inline">Fed LT rate
            <input className="input small" type="number" step="0.001"
              value={profile.federal_lt_rate}
              onChange={(e)=>setProfile(p=>({...p, federal_lt_rate:+e.target.value}))}/>
          </label>

          <label className="inline">State ST rate
            <input className="input small" type="number" step="0.001"
              value={profile.state_st_rate}
              onChange={(e)=>setProfile(p=>({...p, state_st_rate:+e.target.value}))}/>
          </label>

          <label className="inline">State LT rate
            <input className="input small" type="number" step="0.001"
              value={profile.state_lt_rate}
              onChange={(e)=>setProfile(p=>({...p, state_lt_rate:+e.target.value}))}/>
          </label>

          <label className="inline">NIIT rate
            <input className="input small" type="number" step="0.001"
              value={profile.niit_rate}
              onChange={(e)=>setProfile(p=>({...p, niit_rate:+e.target.value}))}/>
          </label>

          <label className="inline">Carry-forward losses
            <input className="input small" type="number" step="1"
              value={profile.carry_forward_losses}
              onChange={(e)=>setProfile(p=>({...p, carry_forward_losses:+e.target.value}))}/>
          </label>
        </div>

        <div className="row">
          <button className="btn primary" disabled={!authed || busy} onClick={onSaveProfile}>Save profile</button>
          <button className="btn" disabled={!authed || busy} onClick={async ()=>{
            try{
              const { data } = await api.get("/api/tax_profile");
              setProfile(data as TaxProfileIn);
              setProfMsg("Loaded.");
            }catch(e){ setProfMsg(isAxiosError(e)?(e.response?.data?.detail || e.message):String(e)); }
          }}>Load existing</button>
        </div>
      </section>

      {/* Import + demo quotes */}
      <section className="section">
        <h3 className="section-title">2. Import holdings CSV & set demo quotes</h3>
        <div className="row" style={{marginBottom:8}}>
          <label className="file">
            <input type="file" accept=".csv" onChange={(e)=>onFile(e.target.files?.[0] ?? null)}/>
            <span className="btn">Choose file</span>
          </label>
          <button className="btn" disabled={!authed || busy} onClick={setDemoQuotes}>Set demo quotes</button>
          <button className="btn" disabled={!authed || busy} onClick={loadAll}>Refresh</button>
        </div>
        <div className="hint">
          Use your CSV like <code>server/data/holdings.example.csv</code>. Demo quotes: AAPL, MSFT, AMZN, NVDA, TSLA.
        </div>
      </section>

      {/* Summary + What-if side-by-side */}
      <section className="section grid-2">
        <div>
          <h3 className="section-title">Summary</h3>
          {!summary ? (
            <div className="muted">No summary yet.</div>
          ) : (
            <div className="stats">
              <div className="stat">
                <div className="label">Pre-Tax Value</div>
                <div className="value">${fmt(summary.pre_tax_value)}</div>
              </div>
              <div className="stat">
                <div className="label">Unrealized Gain</div>
                <div className="value {summary.total_unrealized_gain>=0?'positive':'negative'}">
                  ${fmt(summary.total_unrealized_gain)}
                </div>
              </div>
              <div className="stat">
                <div className="label">Gross Tax on Gains</div>
                <div className="value">${fmt(summary.gross_tax_on_gains)}</div>
              </div>
              <div className="stat">
                <div className="label">Potential Loss Savings</div>
                <div className="value">${fmt(summary.gross_potential_savings_on_losses)}</div>
              </div>
              <div className="stat">
                <div className="label">Net Tax (naive)</div>
                <div className="value">${fmt(summary.naive_net_tax_if_liquidated_now)}</div>
              </div>
              <div className="stat">
                <div className="label">After-Tax Value Now</div>
                <div className="value">${fmt(summary.after_tax_value_if_liquidated_now)}</div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="section-title">What-If: Sell (FIFO)</h3>
          <div className="whatif">
            <input className="input small" value={sym} onChange={(e)=>setSym(e.target.value.toUpperCase())}/>
            <input className="input small" type="number" value={qty} onChange={(e)=>setQty(+e.target.value||0)}/>
            <button className="btn" disabled={!authed || busy} onClick={runWhatIf}>Run</button>
          </div>
          {what && (
            <div className="banner" style={{marginTop:12}}>
              Sell {what.sell_quantity} {what.symbol} @ ${fmt(what.asof_price)} — realized gain ${fmt(what.realized_gain)}, est. tax ${fmt(what.est_tax)}
            </div>
          )}
        </div>
      </section>

      {/* Holdings */}
      <section className="section">
        <h3 className="section-title">Holdings</h3>
        {!lots.length ? (
          <div className="muted">No holdings yet. Import a CSV.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="num">Basis</th>
                  <th className="num">Unreal.</th>
                  <th>Term</th>
                  <th className="num">Days Held</th>
                  <th className="num">Est. Tax</th>
                  <th className="num">After-Tax</th>
                  <th className="num">D2LT</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((r, i)=>(
                  <tr key={i}>
                    <td>{r.symbol}</td>
                    <td className="num">{fmt(r.quantity,0)}</td>
                    <td className="num">{fmt(r.price)}</td>
                    <td className="num">{fmt(r.cost_per_share)}</td>
                    <td className="num">{fmt(r.unrealized_gain)}</td>
                    <td className="term">{r.term}</td>
                    <td className="num">{fmt(r.holding_days,0)}</td>
                    <td className="num">{fmt(r.est_tax_liability)}</td>
                    <td className="num">{fmt(r.after_tax_value)}</td>
                    <td className="num">{fmt(r.days_to_lt,0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Harvest ideas */}
      <section className="section">
        <h3 className="section-title">Harvest candidates</h3>
        {!harvest.length ? (
          <div className="muted">No candidates at the moment.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Lot</th>
                  <th className="num">Qty</th>
                  <th className="num">Basis</th>
                  <th className="num">Px</th>
                  <th className="num">Loss</th>
                  <th className="num">Days→LT</th>
                </tr>
              </thead>
              <tbody>
                {harvest.map((h, i)=>(
                  <tr key={i}>
                    <td>{h.symbol}</td>
                    <td className="num">{h.lot_id ?? "-"}</td>
                    <td className="num">{fmt(h.quantity,0)}</td>
                    <td className="num">{fmt(h.cost_per_share)}</td>
                    <td className="num">{fmt(h.price)}</td>
                    <td className="num">{fmt(h.unrealized_loss)}</td>
                    <td className="num">{fmt(h.days_to_lt,0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
