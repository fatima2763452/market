// FundsView.jsx (UPDATED with Action Handlers)
import React from 'react';
import { TrendingUp, DollarSign, Wallet, ArrowDownCircle, ArrowUpCircle, XCircle } from 'lucide-react';

// --- Helper: Formats currency values (Remains the same) ---
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Helper: Displays a single metric row (Remains the same) ---
const FundMetric = ({ label, value, icon: Icon, valueColorClass = "text-white" }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
        <div className="flex items-center text-gray-400">
            {Icon && <Icon className="w-5 h-5 mr-3 text-indigo-400" />}
            <span className="font-medium text-sm">{label}</span>
        </div>
        <span className={`font-bold text-base ${valueColorClass}`}>
            {formatCurrency(value)}
        </span>
    </div>
);

// -----------------------------------------------------------
// --- MAIN COMPONENT (Accepts new action props) ---
function FundsView({ fundsData, loading, onAddFunds, onWithdraw }) { // <-- ADDED onAddFunds, onWithdraw

    // --- Mock Data (Remains the same) ---
    const mockData = {
        availableBalance: 85240.50,
        totalMargin: 125890.00,
        holdingsValue: 40649.50,
        collateralValue: 0.00,
        payinPending: 500.00,
        payoutPending: 0.00,
        ledgerBalance: 85240.50,
    };
    
    // Use live data if available, otherwise use mock data
    const data = fundsData || mockData;
    
    // Calculate values needed for display
    const blockedFunds = (data.totalMargin - data.availableBalance).toFixed(2);
    const availableForWithdrawal = data.availableBalance - data.payinPending;

    if (loading) {
        return (
            <div className="p-8 text-center text-indigo-400">
                <p>Loading funds data...</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 bg-[#1A1F30] min-h-screen min-w-screen">
            
            {/* 1. Primary Available Margin Card (Remains the same) */}
            <div className="bg-[#2A314A] p-4 rounded-xl shadow-lg border border-indigo-500/50">
                <h3 className="text-gray-400 text-sm mb-1 font-semibold"></h3>
                <p className="text-3xl font-extrabold text-green-400">
                    {formatCurrency(data.availableBalance)}
                </p>
            </div>

            {/* 2. Action Buttons (FIXED) */}
            <div className="flex space-x-3">
                <button 
                    onClick={onAddFunds} // <-- ADDED CLICK HANDLER
                    className="flex-1 p-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition flex items-center justify-center shadow-md"
                >
                    <ArrowUpCircle className="w-5 h-5 mr-2" /> ADD FUNDS
                </button>
                <button 
                    onClick={onWithdraw} // <-- ADDED CLICK HANDLER
                    className="flex-1 p-3 bg-[#333846] text-white rounded-lg font-semibold text-sm hover:bg-[#4a505b] transition flex items-center justify-center shadow-md"
                >
                    <ArrowDownCircle className="w-5 h-5 mr-2" /> WITHDRAW
                </button>
            </div>

            {/* 3. Margin Details Summary (Remains the same) */}
            <div className="bg-[#21283D] p-4 rounded-xl shadow-inner space-y-2">
                <h3 className="text-white text-lg font-bold mb-3 border-b border-white/10 pb-2">Margin & Valuation</h3>
                
                <FundMetric label="Total Margin" value={data.totalMargin} icon={Wallet} valueColorClass="text-yellow-400"/>
                <FundMetric label="Blocked for Orders" value={blockedFunds} icon={XCircle} valueColorClass="text-red-400"/>
                <FundMetric label="Stock Holdings Value" value={data.holdingsValue} icon={TrendingUp} />
                <FundMetric label="Available for Withdrawal" value={availableForWithdrawal} icon={DollarSign} valueColorClass="text-green-400"/>
            </div>
            
            {/* 4. Pending Transactions (Remains the same) */}
            <div className="bg-[#21283D] p-4 rounded-xl shadow-inner space-y-2">
                <h3 className="text-white text-lg font-bold mb-3 border-b border-white/10 pb-2">Pending Transactions</h3>
                
                <FundMetric label="Pay-in Pending" value={data.payinPending} icon={ArrowUpCircle} valueColorClass={data.payinPending > 0 ? "text-yellow-500" : "text-gray-500"}/>
                <FundMetric label="Pay-out Pending" value={data.payoutPending} icon={ArrowDownCircle} valueColorClass={data.payoutPending > 0 ? "text-yellow-500" : "text-gray-500"}/>
            </div>

        </div>
    );
}

export default FundsView;