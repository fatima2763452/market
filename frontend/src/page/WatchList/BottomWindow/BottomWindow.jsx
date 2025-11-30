
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Plus,
  ExternalLink
} from 'lucide-react';


import SummaryView from './Summery'; 
import MarketDepthView from './marketDepth';
import OptionChainView from './OptionChain';
import OptionChainFullscreen from './OptionChainFullscreen'; 


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
  onAddToWatchlist,
  onRemoveFromWatchlist,
  subscriptionType = 'full', // Optional: 'quote' or 'full' - shows data quality badge
}) {
 
  const [viewMode, setViewMode] = useState('Summary'); // Default tab
  const [productType, setProductType] = useState('Intraday');
  const [showFullscreenOptionChain, setShowFullscreenOptionChain] = useState(false);
  const navigate = useNavigate();

  
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

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
      const res = await fetch(`${apiBase}/api/fake-orders`, {
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
        // Just show a placeholder, actual modal is rendered separately
        return (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            <TrendingDown className="w-12 h-12 inline mb-4 text-indigo-400" />
            <p className="text-sm text-[var(--text-secondary)]">Click to open fullscreen option chain</p>
          </div>
        );

      case 'Chart':
        return (
          <div className="p-4 text-center text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg h-96 flex flex-col items-center justify-center">
            <p className="mb-3 text-sm text-[var(--text-secondary)]">View detailed chart with full controls</p>
            <button
              onClick={() => {
                const segment = selectedStock.segment;
                const securityId = selectedStock.securityId;
                navigate(`/chart/${segment}/${securityId}`);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <BarChart className="w-4 h-4" /> 
              Open Full Chart
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Fullscreen Option Chain Modal */}
      {showFullscreenOptionChain && (
        <OptionChainFullscreen
          selectedStock={selectedStock}
          sheetData={sheetData}
          onClose={() => {
            setShowFullscreenOptionChain(false);
            setViewMode('Summary'); // Reset to summary when closing
          }}
        />
      )}
     
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={() => setSelectedStock(null)}
      ></div>

      {/*Bottom Sheet Window */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-card)] shadow-2xl z-50 rounded-t-xl transition-all duration-300 ease-in-out md:max-w-xs md:left-auto md:right-4 md:bottom-4 md:rounded-xl flex flex-col max-h-[95vh]">


        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <h3 className="text-[var(--text-primary)] text-xl font-bold truncate">
              {selectedStock.name || selectedStock.tradingSymbol}
            </h3>
            {/* Data Quality Badge */}
            {subscriptionType && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  subscriptionType === 'full' 
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                    : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                }`}
                title={subscriptionType === 'full' ? 'Full data with market depth' : 'Quote data only'}
              >
                {subscriptionType === 'full' ? 'FULL' : 'QUOTE'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onAddToWatchlist && (
              <button
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                onClick={() => onAddToWatchlist(selectedStock)}
                title="Add to watchlist"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
            {/* {onRemoveFromWatchlist && (
              <button
                className="text-red-400 hover:text-red-300 transition"
                onClick={() => onRemoveFromWatchlist(selectedStock)}
                title="Remove from watchlist"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )} */}
            <button
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              onClick={() => setSelectedStock(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main View Area */}
        <div className="flex-grow overflow-y-auto pr-1">{renderView()}</div>

        {/* Bottom Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-[var(--border-color)] mt-2 pt-2">
          {navItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => {
                if (item.mode === 'OptionChain') {
                  setShowFullscreenOptionChain(true);
                } else if (item.mode === 'Chart') {
                  // Navigate directly to chart page
                  const segment = selectedStock.segment;
                  const securityId = selectedStock.securityId;
                  navigate(`/chart/${segment}/${securityId}`);
                } else {
                  setViewMode(item.mode);
                }
              }}
              title={item.label}
              className={`flex-1 flex flex-col items-center p-2 rounded-lg transition text-xs font-semibold ${
                viewMode === item.mode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <item.icon className="w-4 h-4 mb-0.5" />
              {item.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default BottomWindow;
