import React, { useState, useEffect } from "react";
import { DollarSign, ArrowDownCircle, ArrowUpCircle, Pencil, Check, X } from "lucide-react";
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

export default function FundsView() {
  const [tab, setTab] = useState("intraday");
  
  // --- Data States ---
  const [fundsData, setFundsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Edit States ---
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState("");
  const [updating, setUpdating] = useState(false);

  // --- Context & Config ---
  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  // --- 1. FETCH FUNDS FUNCTION ---
  const fetchFunds = async () => {
    if (!brokerId || !customerId) return;
    setLoading(true);
    try {
        const res = await fetch(`${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        
        if (result.success && result.data) {
            setFundsData(result.data); // Store DB data
        }
    } catch (error) {
        console.error("Failed to fetch funds:", error);
    } finally {
        setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchFunds();
  }, [brokerId, customerId]);


  // --- 2. UPDATE BALANCE FUNCTION ---
  const handleUpdateBalance = async () => {
    if (!tempBalance || isNaN(tempBalance)) return;
    setUpdating(true);

    try {
        const response = await fetch(`${apiBase}/api/funds/updateNetAvailableBalance`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                broker_id_str: brokerId,
                customer_id_str: customerId,
                new_balance: Number(tempBalance)
            })
        });

        if (response.ok) {
            setIsEditing(false);
            await fetchFunds(); // *** Refresh Data after Update ***
        } else {
            alert("Failed to update balance");
        }
    } catch (error) {
        console.error("Error updating balance:", error);
    } finally {
        setUpdating(false);
    }
  };

  // --- Prepare Data for Display ---
  // Default values if data is loading or missing
  const d = {
    net_available_balance: fundsData?.net_available_balance || 0,
    
    // Intraday Data
    intraday_available: fundsData?.intraday?.available_limit || 0,
    intraday_used: fundsData?.intraday?.used_limit || 0,
    // Note: Free limit usually calculated (Available - Used)
    
    // Overnight Data
    overnight_available: fundsData?.overnight?.available_limit || 0,
    overnight_used: fundsData?.overnight?.used_limit || 0,
  };

  if (loading && !fundsData) {
      return <div className="p-10 text-center text-gray-500">Loading Funds...</div>;
  }

  return (
    <div className="p-4 space-y-5 bg-[#0b1020] min-h-screen">

      {/* --- Net Available Balance Card --- */}
      <div className="bg-[#121a2b] p-4 rounded-xl border border-indigo-500/50 relative">
        <h3 className="text-gray-400 text-sm mb-1 font-semibold">Net Available Balance (Cash)</h3>
        
        <div className="flex items-center gap-3">
            {isEditing ? (
                // --- Edit Mode ---
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl text-gray-400 font-bold">₹</span>
                    <input 
                        type="number" 
                        value={tempBalance}
                        onChange={(e) => setTempBalance(e.target.value)}
                        className="bg-[#1f2435] text-white text-xl font-bold p-1 rounded border border-indigo-500/50 w-48 focus:outline-none"
                        autoFocus
                    />
                    <button 
                        onClick={handleUpdateBalance}
                        disabled={updating}
                        className="p-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40 transition"
                    >
                        <Check size={20} />
                    </button>
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="p-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition"
                    >
                        <X size={20} />
                    </button>
                </div>
            ) : (
                // --- Display Mode ---
                <div className="flex items-center gap-3">
                    <p className="text-3xl font-extrabold text-white">
                        {formatCurrency(d.net_available_balance)}
                    </p>
                    
                    {/* ONLY SHOW IF BROKER */}
                    {userRole === 'broker' && (
                        <button 
                            onClick={() => {
                                setTempBalance(d.net_available_balance);
                                setIsEditing(true);
                            }}
                            className="text-gray-500 hover:text-indigo-400 transition p-1 rounded-full hover:bg-white/5"
                            title="Edit Balance"
                        >
                            <Pencil size={16} />
                        </button>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* --- Tabs --- */}
      <div className="mt-3 flex gap-3">
        <Tab active={tab === "intraday"} label="Intraday Fund" onClick={() => setTab("intraday")} />
        <Tab active={tab === "overnight"} label="Overnight Fund" onClick={() => setTab("overnight")} />
      </div>

      {/* --- Child Components (Data Passed Here) --- */}
      {tab === "intraday" ? (
        <IntradayFundCard 
            intradayMaxLimit={d.intraday_available} 
            intradayUsedMargin={d.intraday_used} 
            onRefresh={fetchFunds}
        />
      ) : (
        <OvernightFundCard 
            availableBalance={d.overnight_available} 
            holdingsValue={0} 
            onRefresh={fetchFunds}
        />
      )}
      
    </div>
  );
}