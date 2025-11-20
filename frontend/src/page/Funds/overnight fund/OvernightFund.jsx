// src/page/Funds/overnight_fund/OvernightFund.jsx

import React from "react";
import { TrendingUp, Wallet, Clock } from "lucide-react";
import { FundMetric } from "../FundHelpers.jsx";

export default function OvernightFund({ availableBalance, holdingsValue }) {
  const cash = Number(availableBalance ?? 0);
  const stock = Number(holdingsValue ?? 0);

  return (
    <div className="bg-[#121a2b] p-4 rounded-xl shadow-inner space-y-2">
      <h3 className="text-white text-lg font-bold mb-3 border-b border-white/10 pb-2 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-blue-400" /> Overnight / Delivery Limit
      </h3>

      <FundMetric label="Available Limit (Cash)" value={cash} icon={Wallet} />
      <FundMetric label="Stock Holdings Value" value={stock} icon={TrendingUp} />
    </div>
  );
}
