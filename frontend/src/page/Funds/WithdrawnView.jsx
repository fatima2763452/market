// WithdrawFundsView.jsx
import React, { useState } from 'react';
import { ArrowDownCircle, Banknote, Shield, AlertTriangle, User, DollarSign, Clock } from 'lucide-react';

// --- Helper: Formats currency values ---
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₹ —';
    return `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

function WithdrawFundsView({ availableBalance = 85240.50, onSuccessfulWithdrawal }) {
    
    // Default values for withdrawal (Use realistic mock limits)
    const MIN_WITHDRAWAL = 100;
    const MAX_WITHDRAWAL = availableBalance > 100000 ? 100000 : availableBalance; // Example Limit
    
    const [amount, setAmount] = useState(1000); // Default amount
    const [loading, setLoading] = useState(false);
    
    // Mock Bank Account Details (Needs to be fetched from user data in a real app)
    const mockBankDetails = {
        name: "AXIS BANK LTD",
        account: "XXXX XXXX 1234",
        beneficiary: "JAYPAL S."
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
            alert(`Invalid amount. Must be between ${formatCurrency(MIN_WITHDRAWAL)} and ${formatCurrency(MAX_WITHDRAWAL)}.`);
            return;
        }

        setLoading(true);
        console.log(`Initiating withdrawal for ${formatCurrency(amount)}`);

        // --- MOCK API CALL SIMULATION ---
        // In a real app, call your backend endpoint to initiate the withdrawal request.
        
        setTimeout(() => {
            setLoading(false);
            alert(`Withdrawal of ${formatCurrency(amount)} requested. Expected processing time: 1-2 working days.`);
            
            if (onSuccessfulWithdrawal) {
                onSuccessfulWithdrawal();
            }
        }, 2000); // Slower delay to simulate bank processing time
    };

    const isAmountValid = amount >= MIN_WITHDRAWAL && amount <= MAX_WITHDRAWAL;

    return (
        <div className="p-4 space-y-5 bg-[#1A1F30] min-h-full">
            
            {/* 1. Available Margin and Limit Display */}
            <div className="bg-[#2A314A] p-4 rounded-xl shadow-lg border border-indigo-500/50">
                <h3 className="text-gray-400 text-sm mb-1 font-semibold">Available for Withdrawal</h3>
                <p className="text-3xl font-extrabold text-white">
                    {formatCurrency(availableBalance)}
                </p>
                <p className="text-xs text-yellow-400 mt-1">Max limit: {formatCurrency(MAX_WITHDRAWAL)}</p>
            </div>
            
            {/* 2. Destination Bank Details (Crucial for Security) */}
            <div className="bg-[#21283D] p-4 rounded-xl shadow-inner border border-red-500/30">
                <h3 className="text-gray-300 text-sm mb-2 font-semibold flex items-center">
                    <Banknote className="w-4 h-4 mr-2 text-green-400" />
                    Withdrawal Destination
                </h3>
                <p className="text-white font-semibold">{mockBankDetails.name}</p>
                <p className="text-sm text-gray-400 mt-1">A/c No: {mockBankDetails.account}</p>
                <p className="text-xs text-gray-500">Beneficiary: {mockBankDetails.beneficiary}</p>
            </div>


            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* 3. Amount Input Section */}
                <div className="bg-[#21283D] p-4 rounded-xl shadow-inner">
                    <label className="block text-gray-300 font-semibold mb-3 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-red-400" />
                        Enter Amount to Withdraw
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder={`Min ${MIN_WITHDRAWAL}`}
                        min={MIN_WITHDRAWAL}
                        max={MAX_WITHDRAWAL}
                        required
                        className={`w-full p-3 text-white rounded-lg text-lg border ${isAmountValid ? 'border-gray-600' : 'border-red-500'} bg-[#1A1F30] focus:border-indigo-500 transition`}
                    />
                    {!isAmountValid && amount > 0 && (
                        <p className="text-red-400 text-xs mt-2 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Amount exceeds limit or is invalid.
                        </p>
                    )}
                </div>

                {/* 4. Submission Details and Button */}
                <div className="space-y-3">
                    <p className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-yellow-400" />
                        Processing time: 1-2 business days (Excluding weekends).
                    </p>
                    <button
                        type="submit"
                        className="w-full p-4 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 transition shadow-xl disabled:bg-gray-500 flex items-center justify-center"
                        disabled={loading || !isAmountValid}
                    >
                        {loading ? (
                            <>
                                <Loader className="w-5 h-5 mr-2 animate-spin" />
                                Submitting Request...
                            </>
                        ) : (
                            <>
                                <ArrowDownCircle className="w-6 h-6 mr-2" />
                                Confirm Withdraw {formatCurrency(amount)}
                            </>
                        )}
                    </button>
                </div>
            </form>
            
            {/* 5. Warning */}
            <p className="text-xs text-gray-500 text-center pt-2 flex items-start justify-center">
                <Shield className="w-4 h-4 mr-1 mt-0.5 text-blue-400 flex-shrink-0" />
                <span>Only transfers to the registered bank account are allowed for security reasons.</span>
            </p>

        </div>
    );
}

export default WithdrawFundsView;