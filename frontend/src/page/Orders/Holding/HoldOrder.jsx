// HoldOrder.jsx
import React from "react";
import { MOCK_HOLDINGS } from "../mockData";
import { HoldingCard } from "../commonCards";

export default function HoldOrder() {
  const list = MOCK_HOLDINGS;
  return (
    <>
      <h3 className="text-gray-400 text-sm mb-2">Your Stocks ({list.length})</h3>
      <ul className="space-y-2">
        {list.length ? list.map(h => <HoldingCard key={h.id} h={h} />)
                     : <p className="text-gray-500 text-center py-6 border border-white/10 rounded-lg">No Holdings</p>}
      </ul>
    </>
  );
}
