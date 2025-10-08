// client/src/App.tsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { LotResult, Summary, HarvestCandidate } from "./types";
import {
  api,
  getHoldings,
  getSummary,
  getHarvestCandidates,
  whatIfSell,
  signup,
  login,
  me,
  getToken,
  clearToken,
} from "./api";

function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      await me(); // sanity check
      onAuthed();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>{mode === "login" ? "Log in" : "Sign up"}</h2>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </label>
      {err && <div className="error">{err}</div>}
      <button onClick={submit} disabled={busy || !email || !password}>
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <div className="muted">
        {mode === "login" ? (
          <>No account? <a onClick={() => setMode("signup")}>Sign up</a></>
        ) : (
          <>Have an account? <a onClick={() => setMode("login")}>Log in</a></>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [holdings, setHoldings] = useState<LotResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cands, setCands] = useState<HarvestCandidate[]>([]);
  const [sellSym, setSellSym] = useState("AAPL");
  const [sellQty, setSellQty] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  // global 401 handler: if token expires, kick to login
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          clearToken();
          setAuthed(false);
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const refreshAll = async () => {
    setStatus("Loading…");
    try {
      const [h, s, hc] = await Promise.all([
        getHoldings(),
        getSummary(),
        getHarvestCandidates(10, 50),
      ]);
      setHoldings(h);
      setSummary(s);
      setCands(hc);
      setStatus(null);
    } catch (e: any) {
      setStatus(e?.response?.data?.detail ?? e?.message ?? "Failed to load");
    }
  };

  useEffect(() => {
    if (authed) refreshAll();
  }, [authed]);

  if (!authed) {
    return <div className="container"><AuthGate onAuthed={() => setAuthed(true)} /></div>;
  }

  return (
    <div className="container">
      <header className="row space-between">
        <h1>Tax-Aware Portfolio</h1>
        <div className="row gap">
          <button onClick={() => { clearToken(); setAuthed(false); }}>Log out</button>
          <button onClick={refreshAll}>Refresh</button>
        </div>
      </header>

      {status && <div className="banner">{status}</div>}

      {/* Summary */}
      <section>
        <h2>Summary</h2>
        {summary ? (
          <div className="grid-3">
            <div className="card"><div className="k">Pre-tax value</div><div className="v">${summary.pre_tax_value.toFixed(2)}</div></div>
            <div className="card"><div className="k">Unrealized gain</div><div className="v">${summary.total_unrealized_gain.toFixed(2)}</div></div>
            <div className="card"><div className="k">After-tax (if sold)</div><div className="v">${summary.after_tax_value_if_liquidated_now.toFixed(2)}</div></div>
          </div>
        ) : <div className="muted">No summary yet.</div>}
      </section>

      {/* Holdings */}
      <section>
        <h2>Holdings</h2>
        {holdings.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th><th>Qty</th><th>Price</th><th>Cost</th><th>Gain</th><th>Term</th><th>Est Tax</th><th>After-tax</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={i}>
                  <td>{h.symbol}</td>
                  <td>{h.quantity}</td>
                  <td>${h.price.toFixed(2)}</td>
                  <td>${h.cost_per_share.toFixed(2)}</td>
                  <td className={h.unrealized_gain >= 0 ? "pos" : "neg"}>${h.unrealized_gain.toFixed(2)}</td>
                  <td>{h.term}</td>
                  <td>${h.est_tax_liability.toFixed(2)}</td>
                  <td>${h.after_tax_value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="muted">No holdings yet. Import a CSV.</div>}
      </section>

      {/* Harvest candidates */}
      <section>
        <h2>Tax-loss Harvest Candidates</h2>
        {cands.length ? (
          <table className="table">
            <thead>
              <tr><th>Symbol</th><th>Qty</th><th>Price</th><th>Cost</th><th>Unrealized Loss</th><th>Days→LT</th></tr>
            </thead>
            <tbody>
              {cands.map((c, i) => (
                <tr key={i}>
                  <td>{c.symbol}</td>
                  <td>{c.quantity}</td>
                  <td>${c.price.toFixed(2)}</td>
                  <td>${c.cost_per_share.toFixed(2)}</td>
                  <td className="neg">-${c.unrealized_loss.toFixed(2)}</td>
                  <td>{c.days_to_lt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="muted">No candidates at the moment.</div>}
      </section>

      {/* What-if (quick control; uses last quotes) */}
      <section>
        <h2>What-if Sell</h2>
        <div className="row gap">
          <input value={sellSym} onChange={(e) => setSellSym(e.target.value.toUpperCase())} />
          <input type="number" value={sellQty} onChange={(e) => setSellQty(parseFloat(e.target.value) || 0)} />
          <button onClick={async () => {
            try {
              const r = await whatIfSell(sellSym, sellQty);
              alert(`Realized gain $${r.realized_gain.toFixed(2)}; est tax $${r.est_tax.toFixed(2)}`);
            } catch (e: any) {
              alert(e?.response?.data?.detail ?? e?.message ?? "What-if failed");
            }
          }}>Run</button>
        </div>
      </section>
    </div>
  );
}
