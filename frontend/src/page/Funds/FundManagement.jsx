// fund.jsx (FINAL INTEGRATION CODE)
import React, { useState } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
// Assuming the main view is exported from a file named 'FundsView.jsx' 
import FundsView from './FundView'; 
import AddFundsView from './AddFundView'; // Assumes AddFund.jsx exports AddFundsView
import WithdrawFundsView from './WithdrawnView'; // Assumes Withdrawn.jsx exports WithdrawFundsView

// --- State Definitions ---
const VIEWS = {
    MAIN: 'MAIN',
    ADD: 'ADD',
    WITHDRAW: 'WITHDRAW',
};

function FundManagement() {
    const [currentView, setCurrentView] = useState(VIEWS.MAIN);
    
    // Mock Data (Pass this data through the entire chain)
    const mockFundsData = { availableBalance: 85240.50, totalMargin: 125890.00, holdingsValue: 40649.50 }; 
    const [loading, setLoading] = useState(false); // Example loading state

    const handleBack = () => setCurrentView(VIEWS.MAIN);
    
    // Handler to execute after a successful ADD or WITHDRAW operation
    const handleSuccess = () => {
        // Here you would typically refresh the funds data from your backend
        // For now, we just switch back to the main view.
        // Example: refreshFundsData(); 
        setCurrentView(VIEWS.MAIN);
    };

    // --- Render View Logic ---
    let ComponentToRender = null;
    let HeaderTitle = "My Account Balances";

    switch (currentView) {
        case VIEWS.ADD:
            ComponentToRender = <AddFundsView 
                availableBalance={mockFundsData.availableBalance}
                onSuccessfulDeposit={handleSuccess}
                // NOTE: Add your loading state here if needed
            />;
            HeaderTitle = "Add Funds to Account";
            break;
        
        case VIEWS.WITHDRAW:
            ComponentToRender = <WithdrawFundsView 
                availableBalance={mockFundsData.availableBalance}
                onSuccessfulWithdrawal={handleSuccess}
            />;
            HeaderTitle = "Withdraw Funds";
            break;

        case VIEWS.MAIN:
        default:
            // The main view (FundsView) receives the actions to switch views
            ComponentToRender = <FundsView 
                fundsData={mockFundsData} 
                loading={loading}
                onAddFunds={() => setCurrentView(VIEWS.ADD)} // <-- SWITCHES TO ADD VIEW
                onWithdraw={() => setCurrentView(VIEWS.WITHDRAW)} // <-- SWITCHES TO WITHDRAW VIEW
            />;
            HeaderTitle = "My Account Balances";
            break;
    }

    return (
        <div className="bg-[#1A1F30] min-h-screen text-white">
            
            {/* Custom Header (Handles back button for sub-views) */}
            <div className="p-4 bg-[#2A314A] shadow-md flex items-center sticky top-0 z-10">
                {currentView !== VIEWS.MAIN && (
                    <button onClick={handleBack} className="mr-3 text-gray-400 hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                )}
                <h2 className="text-xl font-semibold">{HeaderTitle}</h2>
            </div>
            
            {/* Render the selected component */}
            <div className="flex-grow">
                {ComponentToRender}
            </div>

        </div>
    );
}

export default FundManagement;