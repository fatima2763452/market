// AddFundsView.jsx
import React, { useState } from 'react';
import { ArrowUpCircle, Banknote, CreditCard, DollarSign, Send, Zap } from 'lucide-react';

// --- Helper: Formats currency values ---
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₹ —';
    return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

function AddFundsView({ availableBalance = 85240.50, onSuccessfulDeposit }) {
    
    const [amount, setAmount] = useState(1000); // Default amount for quick entry
    const [paymentMethod, setPaymentMethod] = useState('UPI'); // Default method
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (amount <= 0 || !paymentMethod) {
            alert("Please enter a valid amount and select a payment method.");
            return;
        }

        setLoading(true);
        console.log(`Initiating ${paymentMethod} transfer for ${formatCurrency(amount)}`);

        // --- MOCK API CALL SIMULATION ---
        // In a real application, you would call your backend endpoint here 
        // to initiate the payment gateway flow.
        
        setTimeout(() => {
            setLoading(false);
            alert(`Payment of ${formatCurrency(amount)} initiated via ${paymentMethod}. Status: Pending`);
            
            // Optional: Call parent function to close sheet or refresh funds
            if (onSuccessfulDeposit) {
                onSuccessfulDeposit();
            }
        }, 1500);
    };

    return (
        <div className="p-4 space-y-5 bg-[#1A1F30] min-h-full">
            
            {/* 1. Available Margin Display */}
            <div className="bg-[#2A314A] p-4 rounded-xl shadow-lg border border-indigo-500/50">
                <h3 className="text-gray-400 text-sm mb-1 font-semibold">Current Available Margin</h3>
                <p className="text-2xl font-extrabold text-white">
                    {formatCurrency(availableBalance)}
                </p>
                <p className="text-xs text-green-400 mt-1">Funds are typically added instantly.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* 2. Amount Input Section */}
                <div className="bg-[#21283D] p-4 rounded-xl shadow-inner">
                    <label className="block text-gray-300 font-semibold mb-3 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-green-400" />
                        Enter Amount to Add
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="Min ₹100"
                        min="100"
                        required
                        className="w-full p-3 bg-[#1A1F30] text-white rounded-lg text-lg border border-gray-600 focus:border-indigo-500 transition"
                    />
                </div>

                {/* 3. Select Payment Method */}
                <div className="space-y-2">
                    <label className="block text-gray-300 font-semibold mb-2">
                        Select Payment Method
                    </label>
                    
                    {/* UPI Option */}
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('UPI')}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition ${paymentMethod === 'UPI' ? 'bg-indigo-600 border-indigo-700' : 'bg-[#21283D] border-gray-600 hover:bg-[#333846]'} border`}
                        disabled={loading}
                    >
                        <div className="flex items-center text-white">
                            <Send className="w-5 h-5 mr-3" />
                            <span className="font-semibold">UPI / Google Pay / PhonePe</span>
                        </div>
                        <span className="text-xs text-green-300">Instant (Recommended)</span>
                    </button>

                    {/* NetBanking Option */}
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('NetBanking')}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition ${paymentMethod === 'NetBanking' ? 'bg-indigo-600 border-indigo-700' : 'bg-[#21283D] border-gray-600 hover:bg-[#333846]'} border`}
                        disabled={loading}
                    >
                        <div className="flex items-center text-white">
                            <CreditCard className="w-5 h-5 mr-3" />
                            <span className="font-semibold">NetBanking / IMPS</span>
                        </div>
                        <span className="text-xs text-yellow-300">Fees may apply</span>
                    </button>
                </div>

                {/* 4. Submit Button */}
                <button
                    type="submit"
                    className="w-full p-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 transition shadow-xl disabled:bg-gray-500 flex items-center justify-center"
                    disabled={loading || amount <= 0}
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <ArrowUpCircle className="w-6 h-6 mr-2" />
                            Add {formatCurrency(amount)} Now
                        </>
                    )}
                </button>
            </form>
            
            {/* 5. Fine Print */}
            <p className="text-xs text-gray-500 text-center pt-2">
                By clicking 'Add Funds', you agree to the payment terms and conditions.
            </p>

        </div>
    );
}

export default AddFundsView;