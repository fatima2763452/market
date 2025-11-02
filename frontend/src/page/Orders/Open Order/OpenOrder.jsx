// OpenOrder.jsx
import React from "react";
import { MOCK_ORDERS } from "../mockData";
import { OrderCard } from "../commonCards";

export default function OpenOrder() {
  const list = MOCK_ORDERS.filter(o => o.status === "OPEN");
  return (
    <>
      <h3 className="text-gray-400 text-sm mb-2">Open Orders ({list.length})</h3>
      <ul className="space-y-2">
        {list.length ? list.map(o => <OrderCard key={o.id} o={o} />)
                     : <p className="text-gray-500 text-center py-6 border border-white/10 rounded-lg">No Open Orders</p>}
      </ul>
    </>
  );
}
