// Summery.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Hash, Zap, TrendingDown, DollarSign as BidAskIcon } from 'lucide-react';
// *** IMPORT FETCH FUND UTILITY ***
import { getFundsData } from '../../../Utils/fetchFund.jsx'; 

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

function Summery({
  selectedStock,
  sheetData,
  actionTab,
  setActionTab,
  quantity,      
  setQuantity,   
  orderPrice,
  setOrderPrice,
  placeFakeOrder,
  setSelectedStock,
  productType,
  setProductType
}) {
  // ---------- local states ----------
  const [jobbin_price, setJobbin_price] = useState("0.08");
  const [localLotsStr, setLocalLotsStr] = useState('');
  const inputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Ensure productType once (Intraday or Overnight)
  useEffect(() => {
    if (!productType) setProductType('Intraday');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // When selectedStock changes, reset local lots
  useEffect(() => {
    const lotSize = selectedStock?.lot_size || selectedStock?.lotSize || 1;
    if (quantity != null) {
      const n = Number(quantity);
      const lots = Number.isFinite(n) && lotSize > 0 ? Math.floor(n / lotSize) : 0;
      setLocalLotsStr(lots > 0 ? String(lots) : '');
    } else {
      setLocalLotsStr('');
    }
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock]);

  // ---------- market values ----------
  const ltpRaw = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
  const bestBidRaw = sheetData?.bestBidPrice != null ? Number(sheetData.bestBidPrice) : null;
  const bestAskRaw = sheetData?.bestAskPrice != null ? Number(sheetData.bestAskPrice) : null;

  const showHigh = sheetData?.high != null ? `₹${Number(sheetData.high).toFixed(2)}` : '—';
  const showLow = sheetData?.low != null ? `₹${Number(sheetData.low).toFixed(2)}` : '—';
  const showClose = sheetData?.close != null ? `₹${Number(sheetData.close).toFixed(2)}` : '—';

  const changeSign = sheetData?.percentChange != null ? (sheetData.percentChange >= 0 ? '▲' : '▼') : '';
  const formattedChangePercent = sheetData?.percentChange != null
    ? `${changeSign} ${Math.abs(Number(sheetData.percentChange)).toFixed(2)}%`
    : '—';

  const getProductTypeClass = (mode) => {
    if (productType !== mode) return 'bg-[#1A1F30] text-gray-400 hover:text-white';
    return actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-red-600 text-white shadow-lg';
  };

  // ---------- calculations ----------
  const lotsNum = useMemo(() => {
    const n = Number(localLotsStr);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }, [localLotsStr]);

  const lotSize = selectedStock?.lot_size || selectedStock?.lotSize || 1;
  const qtyNum = useMemo(() => {
    return lotsNum > 0 ? lotsNum * (Number(lotSize) || 1) : 0;
  }, [lotsNum, lotSize]);

  const jobbinPct = useMemo(() => {
    const v = parseFloat(String(jobbin_price).trim());
    return Number.isFinite(v) ? v / 100 : 0;
  }, [jobbin_price]);

  const baseLtp = ltpRaw ?? bestAskRaw ?? bestBidRaw ?? 0;

  const { adjustedPricePerShareRaw, adjustedPricePerShare } = useMemo(() => {
    if (!baseLtp) return { adjustedPricePerShareRaw: 0, adjustedPricePerShare: 0 };
    const perShareFactor = actionTab === 'Buy' ? (1 + jobbinPct) : (1 - jobbinPct);
    const pxRaw = baseLtp * perShareFactor;
    return { adjustedPricePerShareRaw: pxRaw, adjustedPricePerShare: Number(pxRaw.toFixed(4)) };
  }, [baseLtp, actionTab, jobbinPct]);

  const totalOrderValue = useMemo(() => {
    if (!adjustedPricePerShare || !qtyNum) return 0;
    return Number((adjustedPricePerShare * qtyNum).toFixed(2));
  }, [adjustedPricePerShare, qtyNum]);

  useEffect(() => {
    if (totalOrderValue > 0) setOrderPrice(String(totalOrderValue));
    else setOrderPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOrderValue]);

  // ---------- handlers ----------
  const handleInputChange = (e) => {
    const v = e.target.value;
    setLocalLotsStr(v);
    setFeedback(null); 
  };

  const propagateQtyToParent = () => {
    const rawLots = (localLotsStr || (inputRef.current && inputRef.current.value) || '').toString().trim();
    const n = parseInt(rawLots, 10);
    const lots = Number.isFinite(n) && n > 0 ? n : 0;
    const totalShares = lots > 0 ? String(lots * (Number(lotSize) || 1)) : '';
    setQuantity && setQuantity(totalShares);
  };

  const handleQtyBlur = () => {
    propagateQtyToParent();
  };


  // *** MAIN ORDER HANDLER ***
  const handleConfirm = async () => {
    setSubmitting(true);
    setFeedback(null);

    propagateQtyToParent();

    const rawLots = (localLotsStr || (inputRef.current && inputRef.current.value) || '').toString().trim();
    const parsedLots = parseInt(rawLots, 10);
    const lots = Number.isFinite(parsedLots) && parsedLots > 0 ? parsedLots : 0;

    // 1. Basic Input Validation
    if (!lots) {
      setFeedback({ type: 'error', message: 'Please enter a valid lot count.' });
      setSubmitting(false);
      return;
    }

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : null;
    const brokerId = activeContext?.brokerId || '';
    const customerId = activeContext?.customerId || '';

    const side = actionTab === 'Buy' ? 'BUY' : 'SELL';
    const product = productType === 'Intraday' ? 'MIS' : 'NRML';
    const lot_size = selectedStock?.lot_size || selectedStock?.lotSize || 1;
    const qty = Number(lots) * Number(lot_size);
    const finalPrice = adjustedPricePerShare || baseLtp;

    // *** 2. FUND VALIDATION LOGIC ***
    try {
        // Calculate Total Required Amount for this Order
        const requiredAmount = Number(totalOrderValue);

        // Fetch Latest Funds from Backend
        const fundsData = await getFundsData();
        
        if (!fundsData) {
            throw new Error("Unable to fetch wallet balance.");
        }

        let availableLimit = 0;
        let limitType = "";

        if (productType === 'Intraday') {
            // Intraday Free Limit = Available - Used
            const maxLimit = fundsData.intraday?.available_limit || 0;
            const usedLimit = fundsData.intraday?.used_limit || 0;
            availableLimit = maxLimit - usedLimit;
            limitType = "Intraday";
        } else {
            // Overnight Free Limit = Available - Used
            const maxLimit = fundsData.overnight?.available_limit || 0;
            const usedLimit = fundsData.overnight?.used_limit || 0;
            availableLimit = maxLimit - usedLimit;
            limitType = "Overnight";
        }

        // Check Logic
        if (requiredAmount > availableLimit) {
            // *** NOT ENOUGH BALANCE - RED TOAST ***
            setFeedback({ 
                type: 'error', 
                message: `Insufficient ${limitType} Balance! Required: ₹${requiredAmount}, Available: ₹${availableLimit.toFixed(2)}. Add funds.` 
            });
            setSubmitting(false);
            return; // Stop execution here
        }

    } catch (err) {
        console.error("Fund validation error:", err);
        setFeedback({ type: 'error', message: "Failed to validate funds. Try again." });
        setSubmitting(false);
        return;
    }

    // *** 3. PROCEED TO PLACE ORDER (If Funds OK) ***
    const payload = {
      broker_id_str: brokerId,
      customer_id_str: customerId,
      security_Id: selectedStock?.securityId || '',
      symbol: selectedStock?.tradingSymbol || '',
      segment: selectedStock?.segment || '',
      side,
      product,
      price: Number(finalPrice), 
      quantity: qty,
      lots: Number(lots),
      lot_size: Number(lot_size),
      jobbin_price: jobbin_price, 
      expire: selectedStock?.expiry || new Date().toLocaleString('en-IN'),
      meta: { from: 'ui_watchlist_summery', selectedStock }
    };

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    try {
      const res = await fetch(`${apiBase}/api/orders/postOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }); 
      
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }

      if (!res.ok || (body && body.success === false)) {
        const message = body?.error || body?.message || `Server responded with ${res.status}`;
        throw new Error(message);
      }

      console.log('Order successful:', body);
      // *** GREEN SUCCESS TOAST ***
      setFeedback({ type: 'success', message: 'Order placed successfully!' });

      setTimeout(() => {
        setSelectedStock && setSelectedStock(null);
      }, 1500);

    } catch (err) {
      console.error('Order submission failed', err);
      setFeedback({ type: 'error', message: `Order failed: ${String(err.message || err)}` });

    } finally {
      setSubmitting(false);
    }
  };

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {}; 
  const userRole = userObject.role;

  // Use an input key so React will remount the input only when selectedStock changes.
  const qtyInputKey = selectedStock ? (selectedStock.instrument_token ?? selectedStock.symbol ?? JSON.stringify(selectedStock)) : 'qty-global';

  const formattedCMP = baseLtp ? `₹${baseLtp.toFixed(2)}` : '—';

  return (
    <div className="overflow-y-auto max-h-[80vh] p-2">
      {/* CMP */}
      <div className="mb-4">
        <p className="text-xl font-bold">
          <span className="text-gray-300 mr-1">₹</span>
          <span className={
            sheetData?.isPositive === true
              ? "text-green-500"
              : sheetData?.isPositive === false
                ? "text-red-500"
                : "text-white"
          }>
            {formattedCMP}
          </span>
          <span className={`text-sm font-normal ml-2 ${sheetData?.isPositive === true ? "text-green-400" :
              sheetData?.isPositive === false ? "text-red-400" : "text-gray-400"
            }`}>
            {formattedChangePercent}
          </span>
        </p>
        <p className="text-xs text-gray-500">Current Market Price (CMP)</p>
      </div>

      {/* Buy/Sell */}
      <div className="flex space-x-2 mb-2">
        <button
          className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`}
          onClick={() => setActionTab('Buy')}
        >
          <ShoppingCart className="w-5 h-5 inline mr-1" /> BUY
        </button>
        <button
          className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Sell' ? 'bg-red-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`}
          onClick={() => setActionTab('Sell')}
        >
          <DollarSign className="w-5 h-5 inline mr-1" /> SELL
        </button>
      </div>

      {/* Product type */}
        <h4 className="text-20 font-semibold mb-2 text-white/80 text-muted">Product Order</h4>
      <div className="flex space-x-2 mb-4">
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Intraday')}`} onClick={() => setProductType('Intraday')}>Intraday</button>
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Overnight')}`} onClick={() => setProductType('Overnight')}>Overnight</button>
      </div>

      <h4 className="text-20 font-semibold mb-2 text-white/80 text-muted">Order Type</h4>
      <div className="flex space-x-2 mb-4">
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Market')}`} >Market</button>
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('SL')}`} >SL</button>
      </div>

      {feedback && (
        <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
          {feedback.message}
        </div>
      )}

      {/* Order inputs */}
      <div className="p-3 bg-[#1F2028] rounded-lg mb-4">
        <h4 className="text-lg font-semibold mb-3 text-white">{actionTab === 'Buy' ? 'Place Buy Order' : 'Place Sell Order'}</h4>

        <div className="space-y-3">
          {/* Quantity (Lots) Input */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <h6 className='text-lg font-semibold  text-white'>Lot</h6>
            </div>
            <input
              key={qtyInputKey}
              ref={inputRef}
              value={localLotsStr}
              type="number"
              onChange={handleInputChange}
              onBlur={handleQtyBlur}
              placeholder="enter lots (e.g., 1)"
              className="flex-1 p-2 bg-[#2A314A] text-white rounded-md transition"
            />
            <div className="text-xs text-gray-400 italic">Lot size: <span className="font-medium text-white ml-1">{lotSize}</span></div>
          </div>

          {/* Jobbing % */}
          {userRole === 'broker' && (
          <div className="flex items-center">
            <Hash className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Jobbing %"
              value={jobbin_price}
              onChange={(e) => setJobbin_price(e.target.value)}
              className="w-55 p-2 bg-[#2A314A] text-white rounded-md transition"
            />
          </div>
        )}

         {userRole === 'broker' && (
           <div className="text-xs text-gray-400">Applied jobbing: <span className="text-white font-medium">{jobbin_price || '0'}%</span></div>
        )}

          {/* Price / share and Total */}
          <div className="text-sm bg-[#2A314A] rounded-md p-3 flex flex-col">
            {userRole === 'broker' && (
            <div className="flex justify-between">
              <span className="text-gray-300">Price / share (Jobbing applied)</span>
              <span className="text-white font-semibold">{adjustedPricePerShare ? `₹${adjustedPricePerShare.toFixed(4)}` : '—'}</span>
            </div>
          )}
            <div className="flex justify-between mt-2">
              <span className="text-gray-300">Total Order Value</span>
              <span className="text-white font-semibold">{totalOrderValue ? `₹${totalOrderValue.toFixed(2)}` : '—'}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className={`flex-1 p-3 rounded-lg text-white font-semibold ${actionTab === 'Buy' ? 'bg-green-600' : 'bg-red-600'} ${submitting ? 'opacity-50' : ''}`}
            >
              {submitting ? 'Placing...' : `${actionTab === 'Buy' ? 'Instent Buy' : 'Instent Sell'}`}
            </button>
            <button onClick={() => setSelectedStock(null)} className="p-3 rounded-lg bg-[#333846] text-gray-200 font-medium">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Summery;