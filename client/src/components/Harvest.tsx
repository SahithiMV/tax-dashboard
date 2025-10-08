// client/src/components/Harvest.tsx
import { useEffect, useState } from "react";
import { getHarvestCandidates } from "../api";
import type { HarvestCandidate } from "../types";

export default function Harvest() {
  const [rows, setRows] = useState<HarvestCandidate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try { setRows(await getHarvestCandidates(10, 50)); }
      catch (e:any) { setErr(e?.response?.data?.detail || e.message); }
    })();
  }, []);
  const fmt = (n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});
  return (
    <div className="card">
      <h2>Tax-Loss Harvest Candidates</h2>
      {err && <div style={{color:"crimson"}}>{err}</div>}
      {!err && (
        <table>
          <thead>
            <tr><th>Symbol</th><th>Purchase</th><th>Qty</th><th>Cost</th><th>Price</th><th>Unrealized Loss</th><th>Days→LT</th></tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td>{r.symbol}</td>
                <td>{r.purchase_date}</td>
                <td>{fmt(r.quantity)}</td>
                <td>${fmt(r.cost_per_share)}</td>
                <td>${fmt(r.price)}</td>
                <td style={{color:"crimson"}}>${fmt(r.unrealized_loss)}</td>
                <td>{r.days_to_lt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
