// client/src/components/SummaryCards.tsx
import type { Summary } from "../types";

export default function SummaryCards({ s }: { s: Summary | null }) {
  if (!s) return null;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const cards = [
    { label: "Pre-tax value", value: `$${fmt(s.pre_tax_value)}` },
    { label: "Unrealized P/L", value: `$${fmt(s.total_unrealized_gain)}` },
    { label: "Gross tax on gains", value: `$${fmt(s.gross_tax_on_gains)}` },
    { label: "Potential savings (losses)", value: `$${fmt(s.gross_potential_savings_on_losses)}` },
    { label: "Naive net tax now", value: `$${fmt(s.naive_net_tax_if_liquidated_now)}` },
    { label: "After-tax value now", value: `$${fmt(s.after_tax_value_if_liquidated_now)}` },
  ];
  return (
    <div className="grid cards">
      {cards.map((c) => (
        <div key={c.label} className="card">
          <h2>{c.label}</h2>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
