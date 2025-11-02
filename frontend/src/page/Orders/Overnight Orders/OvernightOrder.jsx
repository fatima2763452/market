// OvernightOrder.jsx
import React from "react";
import { MOCK_ORDERS } from "../mockData";
import { OrderCard } from "../commonCards";

export default function OvernightOrder() {
  const list = MOCK_ORDERS.filter(o => o.type === "LIMIT"); // example logic
  return (
    <>
      <h3 className="text-gray-400 text-sm mb-2">Overnight Orders ({list.length})</h3>
      <ul className="space-y-2">
        {list.length ? list.map(o => <OrderCard key={o.id} o={o} />)
                     : <p className="text-gray-500 text-center py-6 border border-white/10 rounded-lg">No Overnight Orders</p>}
      </ul>
    </>
  );
}
