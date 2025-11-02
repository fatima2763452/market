
import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  BarChart,
  ShoppingCart,
  DollarSign,
  Hash,
  Zap,
  Trash2,
  Layers,
  DollarSign as BidAskIcon,
  TrendingDown,
  ClipboardList,
  ArrowLeft
} from 'lucide-react';


import SummaryView from './Summery'; 
import MarketDepthView from './marketDepth';
import OptionChainView from './OptionChain'; 
import StockChart from './StockChart'; 


const navItems = [
  { label: 'Summary', icon: ClipboardList, mode: 'Summary' },
  { label: 'Market Depth', icon: Layers, mode: 'MarketDepth' },
  { label: 'Option Chain', icon: TrendingDown, mode: 'OptionChain' },
  { label: 'Chart', icon: BarChart, mode: 'Chart' },
];

function BottomWindow({
  selectedStock,
  sheetData,
  actionTab,
  setActionTab,
  quantity,
  setQuantity,
  orderPrice,
  setOrderPrice,
  setSelectedStock,
}) {
 
  const [viewMode, setViewMode] = useState('Summary'); // Default tab
  const [productType, setProductType] = useState('Intraday');
  const [showChart, setShowChart] = useState(false); // Fullscreen chart state

  
  const placeFakeOrder = async () => {
    if (!selectedStock || quantity <= 0 || !orderPrice) return;

    const payload = {
      symbol: selectedStock.tradingSymbol,
      name: selectedStock.name,
      action: actionTab,
      quantity: Number(quantity),
      price: Number(orderPrice),
      timestamp: new Date().toISOString(),
      fake: true,
    };

    try {
      const res = await fetch('/api/fake-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save fake order');

      alert(`${actionTab} order saved (fake) for ${selectedStock.name}`);
      setSelectedStock(null);
    } catch (err) {
      console.error('placeFakeOrder error:', err);
      alert('Could not save order. Check console.');
    }
  };

  if (!selectedStock) return null;

  // --- View Renderer ---
  const renderView = () => {
    const commonProps = { selectedStock, sheetData };
    const summaryProps = {
      actionTab,
      setActionTab,
      quantity,
      setQuantity,
      orderPrice,
      setOrderPrice,
      placeFakeOrder,
      setSelectedStock,
      productType,
      setProductType,
    };

    switch (viewMode) {
      case 'Summary':
        return <SummaryView {...commonProps} {...summaryProps} />;

      case 'MarketDepth':
        return (
          <MarketDepthView
            stockName={selectedStock.name}
            sheetData={sheetData}
          />
        );

      case 'OptionChain':
        return <OptionChainView {...commonProps} />;

      case 'Chart':
        return (
          <div className="p-4 text-center text-white/70 bg-[#1A1F30] rounded-lg h-96 flex flex-col items-center justify-center">
            <p className="mb-3 text-sm text-gray-400">Live Market Chart</p>
            <button
              onClick={() => setShowChart(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition"
            >
              <BarChart className="w-4 h-4 inline mr-2" /> Open Full Chart
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
     
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={() => setSelectedStock(null)}
      ></div>

      {/*Bottom Sheet Window */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#2A314A] shadow-2xl z-50 rounded-t-xl transition-all duration-300 ease-in-out md:max-w-xs md:left-auto md:right-4 md:bottom-4 md:rounded-xl flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3 flex-shrink-0">
          <h3 className="text-white text-xl font-bold truncate">
            {selectedStock.name}
          </h3>
          <button
            className="text-gray-400 hover:text-white transition"
            onClick={() => setSelectedStock(null)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main View Area */}
        <div className="flex-grow overflow-y-auto pr-1">{renderView()}</div>

        {/* Bottom Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-white/10 mt-2 pt-2">
          {navItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => setViewMode(item.mode)}
              title={item.label}
              className={`flex-1 flex flex-col items-center p-2 rounded-lg transition text-xs font-semibold ${
                viewMode === item.mode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#333846] text-gray-400 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4 mb-0.5" />
              {item.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/*FULLSCREEN CHART OVERLAY */}
      {showChart && (
        <div className="fixed inset-0 bg-[#0E1324] text-white z-[100] flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1A1F30]">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowChart(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold">
                Detailed Chart — {selectedStock.name}
              </h2>
            </div>
          </div>

          {/* Chart Display */}
          <div className="flex-grow overflow-y-auto p-3">
            <StockChart
              symbol={selectedStock.instrument_key || selectedStock.tradingSymbol}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default BottomWindow;
