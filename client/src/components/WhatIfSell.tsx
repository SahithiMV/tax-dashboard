// client/src/components/WhatIfSell.tsx
import { useState } from "react";
import { whatIfSell } from "../api";

export default function WhatIfSell() {
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(1);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setErr(null); setOut(null);
    try { setOut(await whatIfSell(symbol.toUpperCase(), qty)); }
    catch (e: any) { setErr(e?.response?.data?.detail || e.message); }
  };
  return (
    <div className="card">
      <h2>What-If Sell (FIFO)</h2>
      <div className="row">
        <input value={symbol} onChange={(e)=>setSymbol(e.target.value)} placeholder="Symbol"/>
        <input type="number" step="0.01" value={qty} onChange={(e)=>setQty(parseFloat(e.target.value||"0"))} placeholder="Qty"/>
        <button onClick={run}>Estimate</button>
      </div>
      {err && <div style={{color:"crimson", marginTop:8}}>{err}</div>}
      {out && (
        <div style={{marginTop:8}}>
          <div><b>{out.symbol}</b> @ ${out.asof_price} for {out.sell_quantity} shares</div>
          <div>Realized gain: ${out.realized_gain.toLocaleString()}</div>
          <div>Est. tax: ${out.est_tax.toLocaleString()}</div>
          <table style={{marginTop:8}}>
            <thead><tr><th>Lot</th><th>Qty used</th><th>Term</th><th>Gain</th><th>Est. Tax</th></tr></thead>
            <tbody>
              {out.lots_consumed.map((d:any,i:number)=>(
                <tr key={i}>
                  <td>{d.lot_id ?? "-"}</td>
                  <td>{d.qty_used}</td>
                  <td>{d.term}</td>
                  <td>${d.realized_gain}</td>
                  <td>${d.est_tax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
