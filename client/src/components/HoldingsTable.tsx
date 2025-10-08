// client/src/components/HoldingsTable.tsx
import type { LotResult } from "../types";

export default function HoldingsTable({ rows }: { rows: LotResult[] }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <div className="card">
      <h2>Holdings (per-lot)</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th><th>Qty</th><th>Cost</th><th>Price</th><th>Days</th>
            <th>Term</th><th>Unrealized</th><th>Est. Tax</th><th>After-Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.symbol}</td>
              <td>{fmt(r.quantity)}</td>
              <td>${fmt(r.cost_per_share)}</td>
              <td>${fmt(r.price)}</td>
              <td>{r.holding_days}</td>
              <td><span className="badge">{r.term}</span></td>
              <td style={{ color: r.unrealized_gain >= 0 ? "green" : "crimson" }}>${fmt(r.unrealized_gain)}</td>
              <td>${fmt(r.est_tax_liability)}</td>
              <td>${fmt(r.after_tax_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
