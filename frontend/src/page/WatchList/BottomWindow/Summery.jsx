// SummaryView.jsx (FINAL CODE with Corrected Product Button Styling and Default)
import React from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Target, Hash, Zap, DollarSign as BidAskIcon } from 'lucide-react';

// --- Helper component to display detailed rows (Remains the same) ---
const DetailRow = ({ Icon, label, value, colorClass = "text-white/90" }) => (
    <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-b-0">
        <div className="flex items-center text-gray-400 text-sm">
            <Icon className="w-4 h-4 mr-2 text-indigo-400" />
            {label}
        </div>
        <span className={`font-medium text-sm ${value === '—' ? 'text-gray-500' : colorClass}`}>
            {value}
        </span>
    </div>
);

function Summery({ selectedStock, sheetData, actionTab, setActionTab, quantity, setQuantity, orderPrice, setOrderPrice, placeFakeOrder, setSelectedStock, productType, setProductType }) {

    // Helper functions for formatting (Remains the same)
    const formattedLTP = sheetData.ltp != null ? Number(sheetData.ltp).toFixed(2) : "—";
    const bestBid = sheetData.bestBidPrice != null ? `₹${Number(sheetData.bestBidPrice).toFixed(2)} (${sheetData.bestBidQuantity ?? '—'})` : '—';
    const bestAsk = sheetData.bestAskPrice != null ? `₹${Number(sheetData.bestAskPrice).toFixed(2)} (${sheetData.bestAskQuantity ?? '—'})` : '—';
    const formattedVolumeDetail = sheetData.volume != null ? (Number(sheetData.volume) / 1000).toFixed(1) + 'K' : '—';
    const changeSign = sheetData.percentChange != null ? (sheetData.percentChange >= 0 ? '▲' : '▼') : '';
    const formattedChangePercent = sheetData.percentChange != null ? `${changeSign} ${Math.abs(Number(sheetData.percentChange)).toFixed(2)}%` : '—';

    // Set default product type to Intraday if it hasn't been set yet (initial load)
    // NOTE: This logic should ideally live in BottomWindow's useState, but we check here for safety.
    if (!productType) setProductType('Intraday');


    // Helper to determine the background color based on active product and action
    const getProductTypeClass = (mode) => {
        if (productType !== mode) {
            return 'bg-[#1A1F30] text-gray-400 hover:text-white'; // Unselected
        }
        // Selected: Use Buy (Green) or Sell (Red) color
        return actionTab === 'Buy'
            ? 'bg-green-600 text-white shadow-lg'
            : 'bg-red-600 text-white shadow-lg';
    };

    return (
        <div className="overflow-y-auto max-h-[80vh] p-2">

            {/* Price Display and Detail Rows (Remain the same) */}
            <div className="mb-4">
                <p className="text-xl font-bold">
                    <span className="text-gray-300 mr-1">₹</span>
                    <span className={sheetData.isPositive === true ? "text-green-500" : sheetData.isPositive === false ? "text-red-500" : "text-white"}>
                        {formattedLTP}
                    </span>
                    <span className={`text-sm font-normal ml-2 ${sheetData.isPositive === true ? "text-green-400" : sheetData.isPositive === false ? "text-red-400" : "text-gray-400"}`}>
                        {formattedChangePercent}
                    </span>
                </p>
                <p className="text-xs text-gray-500">Current Market Price (CMP)</p>
            </div>

            <div className="mb-4 p-2 bg-[#1A1F30] rounded-lg">
                <DetailRow Icon={BidAskIcon} label="Best Bid (Buy)" value={bestBid} colorClass="text-green-400" />
                <DetailRow Icon={BidAskIcon} label="Best Ask (Sell)" value={bestAsk} colorClass="text-red-400" />
                <DetailRow Icon={Zap} label="LTP" value={`₹${formattedLTP}`} colorClass={sheetData.isPositive === true ? "text-green-400" : sheetData.isPositive === false ? "text-red-400" : "text-white/90"} />
                <DetailRow Icon={TrendingUp} label="Volume" value={formattedVolumeDetail} />
            </div>

            {/* Buy/Sell Tabs */}


            {/* // ... Buy/Sell Tabs ... */}

            <div className="flex space-x-2 mb-2">
                <button
                    className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`}
                    // FIX: Remove setProductType('Intraday') from here
                    onClick={() => { setActionTab('Buy'); }}
                >
                    <ShoppingCart className="w-5 h-5 inline mr-1" /> BUY
                </button>
                <button
                    className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Sell' ? 'bg-red-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`}
                    // FIX: Remove setProductType('Intraday') from here
                    onClick={() => { setActionTab('Sell'); }}
                >
                    <DollarSign className="w-5 h-5 inline mr-1" /> SELL
                </button>
            </div>

{/* // ... (Rest of the code remains the same) */}

            {/* --- NEW PRODUCT TYPE BUTTONS (Correct Styling) --- */}
            <div className="flex space-x-2 mb-4">
                <button
                    className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Intraday')}`}
                    onClick={() => setProductType('Intraday')}
                >
                    Intraday
                </button>
                <button
                    className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Intranight')}`}
                    onClick={() => setProductType('Intranight')}
                >
                    Intranight
                </button>
            </div>
            {/* --- END NEW PRODUCT TYPE BUTTONS --- */}

            {/* Order Inputs (Remains the same) */}
            <div className="p-3 bg-[#1F2028] rounded-lg mb-4">
                <h4 className="text-lg font-semibold mb-3 text-white">
                    {actionTab === 'Buy' ? 'Place Buy Order' : 'Place Sell Order'}
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center">
                        <Hash className="w-5 h-5 text-gray-400 mr-2" />
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="Quantity (e.g., 10)"
                            className="w-full p-2 bg-[#2A314A] text-white rounded-md transition"
                        />
                    </div>
                    <div className="flex items-center">
                        <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
                        <input
                            type="number"
                            placeholder="Price (Limit/Market)"
                            value={orderPrice}
                            onChange={(e) => setOrderPrice(e.target.value)}
                            className="w-full p-2 bg-[#2A314A] text-white rounded-md transition"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={placeFakeOrder}
                            className={`flex-1 p-3 rounded-lg text-white font-semibold ${actionTab === 'Buy' ? 'bg-green-600' : 'bg-red-600'}`}
                        >
                            {actionTab === 'Buy' ? 'Save Fake Buy' : 'Save Fake Sell'}
                        </button>
                        <button
                            onClick={() => { setSelectedStock(null); }}
                            className="p-3 rounded-lg bg-[#333846] text-gray-200 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Summery;