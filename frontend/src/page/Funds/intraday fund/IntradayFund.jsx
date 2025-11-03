// src/page/Funds/intraday_fund/IntradayFund.jsx

import React from "react";
import { Wallet, DollarSign, XCircle, Zap } from "lucide-react";
import { FundMetric } from "../FundHelpers.jsx";

export default function IntradayFund({ intradayMaxLimit, intradayUsedMargin }) {
  const max = Number(intradayMaxLimit ?? 0);
  const used = Number(intradayUsedMargin ?? 0);
  const free = Math.max(0, max - used);

  return (
    <div className="bg-[#121a2b] p-4 rounded-xl shadow-inner space-y-2">
      <h3 className="text-white text-lg font-bold mb-3 border-b border-white/10 pb-2 flex items-center">
        Intraday Trading Margin
      </h3>

      <FundMetric label="Available Limit" value={max} icon={Wallet} valueColorClass="text-yellow-400" />
      <FundMetric label="Free Limit (Unused)" value={free} icon={DollarSign} valueColorClass="text-green-400" />
      <FundMetric label="Used Limit (Blocked)" value={used} icon={XCircle} valueColorClass="text-red-400" />
    </div>
  );
}
