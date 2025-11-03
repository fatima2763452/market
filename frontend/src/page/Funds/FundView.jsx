// src/page/Funds/FundView.jsx

import React, { useState } from "react";
import { DollarSign, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { FundMetric, formatCurrency } from "./FundHelpers.jsx";
import IntradayFundCard from "./intraday fund/IntradayFund.jsx";
import OvernightFundCard from "./overnight fund/OvernightFund.jsx";

const Tab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1 rounded-full text-sm font-semibold ${
      active ? "bg-fuchsia-600 text-white" : "bg-[#1f2435] text-gray-300 hover:bg-[#2a3145]"
    }`}
  >
    {label}
  </button>
);

export default function FundsView({ fundsData, loading, onAddFunds, onWithdraw }) {
  const [tab, setTab] = useState("intraday");

  const mock = {
    availableBalance: 85240.5,
    payinPending: 500,
    holdingsValue: 40649.5,
    intradayMaxLimit: 150000,
    intradayUsedMargin: 24750,
    payoutPending: 0,
  };

  const d = { ...mock, ...fundsData };
  const availableForWithdrawal = d.availableBalance - d.payinPending;

  return (
    <div className="p-4 space-y-5 bg-[#0b1020] min-h-screen">

      <div className="bg-[#121a2b] p-4 rounded-xl border border-indigo-500/50">
        <h3 className="text-gray-400 text-sm mb-1 font-semibold">Net Available Balance (Cash)</h3>
        <p className="text-3xl font-extrabold text-white">{formatCurrency(d.availableBalance)}</p>
      </div>


      <div className="mt-3 flex gap-3">
        <Tab active={tab === "intraday"} label="Intraday Fund" onClick={() => setTab("intraday")} />
        <Tab active={tab === "overnight"} label="Overnight Fund" onClick={() => setTab("overnight")} />
      </div>

      {tab === "intraday" ? (
        <IntradayFundCard intradayMaxLimit={d.intradayMaxLimit} intradayUsedMargin={d.intradayUsedMargin} />
      ) : (
        <OvernightFundCard availableBalance={d.availableBalance} holdingsValue={d.holdingsValue} />
      )}

      
    </div>
  );
}
