// commonCards.jsx
import React from "react";

/* helpers */
export const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
export const orderPnl = (o) => {
  const diff = o.side === "BUY" ? o.ltp - o.avgPrice : o.avgPrice - o.ltp;
  const pnl = diff * o.qty;
  const pct = o.avgPrice ? (diff / o.avgPrice) * 100 : 0;
  return { pnl, pct };
};
export const holdingPnl = (h) => {
  const diff = h.ltp - h.avgPrice;
  const pnl = diff * h.qty;
  const pct = h.avgPrice ? (diff / h.avgPrice) * 100 : 0;
  return { pnl, pct };
};

const Accent = () => (
  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-fuchsia-500/90" />
);

/* compact order card */
export const OrderCard = ({ o }) => {
  const { pnl, pct } = orderPnl(o);
  const profit = pnl >= 0;
  const pnlColor = profit ? "text-green-400" : "text-red-400";
  const pctText = `${profit ? "+" : ""}${pnl.toFixed(2)} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

  return (
    <li className="relative bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition">
      <Accent />
      <div className="flex items-start justify-between">
        <h4 className="text-[var(--text-primary)] font-bold tracking-wide text-sm">{o.symbol}</h4>
        <div className={`text-xs font-bold ${pnlColor}`}>{pctText}</div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-y-1 text-[12px]">
        <div className="text-[var(--text-secondary)]">Qty: <span className="text-[var(--text-primary)]">{o.qty}</span></div>
        <div className="text-right text-[var(--text-secondary)]">LTP: <span className="text-[var(--text-primary)] font-semibold">{money(o.ltp)}</span></div>
        <div className="text-[var(--text-secondary)]">Avg: <span className="text-[var(--text-primary)]">{money(o.avgPrice)}</span></div>
        <div className="text-right text-[var(--text-secondary)]">Total P&L: <span className={`${pnlColor} font-semibold`}>{money(pnl)}</span></div>
      </div>
      <button className="mt-1 text-fuchsia-300 hover:text-fuchsia-200 text-[12px] font-medium underline-offset-4 hover:underline">
        View Chart & Details
      </button>
    </li>
  );
};

/* compact holding card */
export const HoldingCard = ({ h }) => {
  const { pnl, pct } = holdingPnl(h);
  const profit = pnl >= 0;
  const pnlColor = profit ? "text-green-400" : "text-red-400";
  const pctText = `${profit ? "+" : ""}${pnl.toFixed(2)} (${profit ? "+" : ""}${pct.toFixed(2)}%)`;

  return (
    <li className="relative bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition">
      <Accent />
      <div className="flex items-start justify-between">
        <h4 className="text-[var(--text-primary)] font-bold tracking-wide text-sm">{h.symbol}</h4>
        <div className={`text-xs font-bold ${pnlColor}`}>{pctText}</div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-y-1 text-[12px]">
        <div className="text-[var(--text-secondary)]">Qty: <span className="text-[var(--text-primary)]">{h.qty}</span></div>
        <div className="text-right text-[var(--text-secondary)]">LTP: <span className="text-[var(--text-primary)] font-semibold">{money(h.ltp)}</span></div>
        <div className="text-[var(--text-secondary)]">Avg: <span className="text-[var(--text-primary)]">{money(h.avgPrice)}</span></div>
        <div className="text-right text-[var(--text-secondary)]">Total P&L: <span className={`${pnlColor} font-semibold`}>{money(pnl)}</span></div>
      </div>
      <button className="mt-1 text-fuchsia-300 hover:text-fuchsia-200 text-[12px] font-medium underline-offset-4 hover:underline">
        View Chart & Details
      </button>
    </li>
  );
};
