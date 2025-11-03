import React, { useState, useMemo } from 'react';
import { DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

import { FundMetric, formatCurrency } from './FundHelpers.jsx';
import IntradayFundCard from './intraday fund/IntradayFund.jsx';
import OvernightFundCard from './overnight fund/OvernightFund.jsx';

const TabPill = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={
      "px-4 py-2 rounded-full text-sm font-semibold transition " +
      (active
        ? "bg-fuchsia-600 text-white shadow " // active look (like your screenshot)
        : "bg-[#1f2435] text-gray-300 hover:bg-[#2a3145]"
      )
    }
  >
    {children}
  </button>
);

function FundsView({ fundsData, loading, onAddFunds, onWithdraw }) {
  // Tabs: "intraday" | "overnight"
  const [activeTab, setActiveTab] = useState("intraday");

  // Fallback mock (remove when wiring to API)
  const mockData = {
    availableBalance: 85240.50,
    payinPending: 500.00,
    holdingsValue: 40649.50,
    intradayMaxLimit: 150000.00,
    intradayUsedMargin: 24750.00,
    payoutPending: 0.00,
  };

  const data = useMemo(() => ({
    availableBalance: Number((fundsData?.availableBalance ?? mockData.availableBalance) || 0),
    payinPending: Number((fundsData?.payinPending ?? mockData.payinPending) || 0),
    holdingsValue: Number((fundsData?.holdingsValue ?? mockData.holdingsValue) || 0),
    intradayMaxLimit: Number((fundsData?.intradayMaxLimit ?? mockData.intradayMaxLimit) || 0),
    intradayUsedMargin: Number((fundsData?.intradayUsedMargin ?? mockData.intradayUsedMargin) || 0),
    payoutPending: Number((fundsData?.payoutPending ?? mockData.payoutPending) || 0),
  }), [fundsData]);

  const availableForWithdrawal = data.availableBalance - data.payinPending;

  if (loading) {
    return (
      <div className="p-8 text-center text-indigo-400">
        <p>Loading funds data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 bg-[#0b1020] min-h-screen">

      {/* Header balance card */}
      <div className="bg-[#121a2b] p-4 rounded-xl shadow-lg border border-indigo-500/50">
        <h3 className="text-gray-400 text-sm mb-1 font-semibold">Net Available Balance (Cash)</h3>
        <p className="text-3xl font-extrabold text-white">
          {formatCurrency(data.availableBalance)}
        </p>
      </div>


      {/* Tabs row (like your Orders screenshot) */}
      <div className="pt-2">
        <div className="text-white text-xl font-bold">Funds</div>
        <div className="h-1 bg-fuchsia-600 w-16 rounded mt-1" />
        <div className="flex gap-3 mt-3">
          <TabPill active={activeTab === "intraday"} onClick={() => setActiveTab("intraday")}>
            Intraday Fund
          </TabPill>
          <TabPill active={activeTab === "overnight"} onClick={() => setActiveTab("overnight")}>
            Overnight Fund
          </TabPill>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "intraday" ? (
        <IntradayFundCard
          intradayMaxLimit={data.intradayMaxLimit}
          intradayUsedMargin={data.intradayUsedMargin}
        />
      ) : (
        <OvernightFundCard
          availableBalance={data.availableBalance}
          holdingsValue={data.holdingsValue}
        />
      )}

      
    </div>
  );
}

export default FundsView;
