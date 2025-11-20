// Summery.jsx (robust: prevents parent from clobbering quantity while typing)
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Hash, Zap, TrendingDown, DollarSign as BidAskIcon } from 'lucide-react';

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
  quantity,      // kept for initial/confirm only
  setQuantity,   // call only on blur/confirm
  orderPrice,
  setOrderPrice,
  placeFakeOrder,
  setSelectedStock,
  productType,
  setProductType
}) {
  // ---------- local states ----------
  const [jobbin_price, setJobbin_price] = useState("0.08");
  const [localQtyStr, setLocalQtyStr] = useState(quantity != null ? String(quantity) : '');
  const inputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // Ensure productType once
  useEffect(() => {
    if (!productType) setProductType('Intraday');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType]);

  // When selectedStock changes, reset local qty to parent's quantity (or blank)
  // Using selectedStock ensures we don't overwrite while typing on unrelated renders.
  useEffect(() => {
    setLocalQtyStr(quantity != null ? String(quantity) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock]);

  // ---------- market values ----------
  const ltpRaw     = sheetData?.ltp != null ? Number(sheetData.ltp) : null;
  const bestBidRaw = sheetData?.bestBidPrice != null ? Number(sheetData.bestBidPrice) : null;
  const bestAskRaw = sheetData?.bestAskPrice != null ? Number(sheetData.bestAskPrice) : null;

  const bestBidDisp = bestBidRaw != null
    ? `₹${bestBidRaw.toFixed(2)} (${sheetData?.bestBidQuantity ?? '—'})`
    : '—';
  const bestAskDisp = bestAskRaw != null
    ? `₹${bestAskRaw.toFixed(2)} (${sheetData?.bestAskQuantity ?? '—'})`
    : '—';

  const showHigh = sheetData?.high != null ? `₹${Number(sheetData.high).toFixed(2)}` : '—';
  const showLow  = sheetData?.low  != null ? `₹${Number(sheetData.low).toFixed(2)}`  : '—';
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
  // parse qty from local string for live use (0 if invalid)
  const qtyNum = useMemo(() => {
    const n = Number(localQtyStr);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [localQtyStr]);

  const jobbinPct = useMemo(() => {
    const v = Number(jobbin_price);
    return Number.isFinite(v) ? v / 100 : 0;
  }, [jobbin_price]);

  const baseLtp = ltpRaw ?? bestAskRaw ?? bestBidRaw ?? 0;

  // per-share adjusted price (apply jobbing% once)
  const adjustedPricePerShare = useMemo(() => {
    if (!baseLtp) return 0;
    const perShareFactor = actionTab === 'Buy' ? (1 + jobbinPct) : (1 - jobbinPct);
    const px = baseLtp * perShareFactor;
    return px > 0 ? Number(px.toFixed(2)) : 0;
  }, [baseLtp, actionTab, jobbinPct]);

  // total order value (per-share * qty)
  const totalOrderValue = useMemo(() => {
    if (!adjustedPricePerShare || !qtyNum) return 0;
    return Number((adjustedPricePerShare * qtyNum).toFixed(2));
  }, [adjustedPricePerShare, qtyNum]);

  // sync total to parent orderPrice (so placeFakeOrder can read it)
  useEffect(() => {
    if (totalOrderValue > 0) setOrderPrice(String(totalOrderValue));
    else setOrderPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOrderValue]);

  // ---------- handlers ----------
  const handleInputChange = (e) => {
    const v = e.target.value;
    // allow empty or numeric; keep as string to preserve typing
    setLocalQtyStr(v);
  };

  const propagateQtyToParent = () => {
    // read the raw value from inputRef if needed
    const val = (inputRef.current && inputRef.current.value) || localQtyStr;
    setQuantity(val);
  };

  const handleQtyBlur = () => {
    propagateQtyToParent();
  };

const activeContextString = localStorage.getItem('activeContext')
const activeContext = JSON.parse(activeContextString);
const brokerId = activeContext.brokerId;
const customerId = activeContext.customerId;

const handleConfirm = async () => {

    propagateQtyToParent();

    const qty = Number((inputRef.current && inputRef.current.value) || localQtyStr) || 0;
    if (!qty || qty <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid quantity.' });
      return;
    }

    const side = actionTab === 'Buy' ? 'BUY' : 'SELL';
    const product = productType === 'Intraday' ? 'MIS' : 'NRML';

    // console.log(selectedStock)
    // console.log(`-------------------------${jobbin_price}-----------------------------`)

    const payload = {
      broker_id_str:  brokerId || '',
      customer_id_str: customerId || '',
      security_Id: selectedStock?.securityId || '',
      symbol: selectedStock?.tradingSymbol || '',
      segment : selectedStock?.segment || '',
      side,
      product,
      price: orderPrice ? Number(orderPrice) : Number(adjustedPricePerShare) || 0,
      quantity: qty,
      jobbin_price: jobbin_price,
      lot_size: selectedStock?.lot_size || selectedStock?.lotSize || 1,
      meta: { from: 'ui_watchlist_summery', selectedStock }
    };                                                                            

    setSubmitting(true);
  

    try {
      
      const res = await fetch('/api/orders/postOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded with ${res.status}`);
      }
      console.log(res)
      alert("order place successfully")
     
      setSelectedStock && setSelectedStock(null);
    } catch (err) {
      console.error('Order submission failed', err);
    
    } finally {
      setSubmitting(false);
    }
  };

  // Use an input key so React will remount the input only when selectedStock changes.
  // This prevents any parent re-render from forcing defaultValue resets.
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
          <span className={`text-sm font-normal ml-2 ${
            sheetData?.isPositive === true ? "text-green-400" :
            sheetData?.isPositive === false ? "text-red-400" : "text-gray-400"
          }`}>
            {formattedChangePercent}
          </span>
        </p>
        <p className="text-xs text-gray-500">Current Market Price (CMP)</p>
      </div>

      {/* Best Bid/Ask + High/Low */}
      <div className="mb-4 p-2 bg-[#1A1F30] rounded-lg">
        <DetailRow Icon={BidAskIcon} label="Best Bid (Buy)" value={bestBidDisp} colorClass="text-green-400" />
        <DetailRow Icon={BidAskIcon} label="Best Ask (Sell)" value={bestAskDisp} colorClass="text-red-400" />
        <DetailRow Icon={Zap} label="Day High" value={showHigh} colorClass="text-yellow-300" />
        <DetailRow Icon={TrendingUp} label="Day Low" value={showLow} colorClass="text-blue-300" />
        <DetailRow Icon={TrendingDown} label="Prev. Close" value={showClose} colorClass="text-gray-400" />
      </div>

      {/* Buy/Sell */}
      <div className="flex space-x-2 mb-2">
        <button className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`} onClick={() => setActionTab('Buy')}>
          <ShoppingCart className="w-5 h-5 inline mr-1" /> BUY
        </button>
        <button className={`flex-1 p-2 rounded-lg font-semibold transition ${actionTab === 'Sell' ? 'bg-red-600 text-white shadow-lg' : 'bg-[#21283D] text-gray-400 hover:text-white'}`} onClick={() => setActionTab('Sell')}>
          <DollarSign className="w-5 h-5 inline mr-1" /> SELL
        </button>
      </div>

      {/* Product type */}
      <div className="flex space-x-2 mb-4">
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Intraday')}`} onClick={() => setProductType('Intraday')}>Intraday</button>
        <button className={`flex-1 p-2 rounded-lg text-xs font-medium transition ${getProductTypeClass('Intranight')}`} onClick={() => setProductType('Intranight')}>Overnight</button>
      </div>

      {/* Order inputs */}
      <div className="p-3 bg-[#1F2028] rounded-lg mb-4">
        <h4 className="text-lg font-semibold mb-3 text-white">{actionTab === 'Buy' ? 'Place Buy Order' : 'Place Sell Order'}</h4>

        <div className="space-y-3">
          {/* Quantity (uncontrolled default + local state for live calc) */}
          <div className="flex items-center">
            <Hash className="w-5 h-5 text-gray-400 mr-2" />
            <input
              key={qtyInputKey}
              ref={inputRef}
              defaultValue={localQtyStr}
              type="number"
              onChange={handleInputChange}
              onBlur={handleQtyBlur}
              placeholder="Quantity (e.g., 10)"
              className="w-full p-2 bg-[#2A314A] text-white rounded-md transition"
            />
          </div>

          {/* Jobbing % */}
          <div className="flex items-center">
            <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Jobbing % — 0.08 means 0.08%, or 3 means 3%"
              value={jobbin_price}
              onChange={(e) => setJobbin_price(e.target.value)}
              className="w-full p-2 bg-[#2A314A] text-white rounded-md transition"
            />
          </div>

          {/* Price / share and Total */}
          <div className="text-sm bg-[#2A314A] rounded-md p-3 flex flex-col">
            <div className="flex justify-between">
              <span className="text-gray-300">Price / share (Jobbing applied)</span>
              <span className="text-white font-semibold">{adjustedPricePerShare ? `₹${adjustedPricePerShare.toFixed(2)}` : '—'}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-300">Total Order Value</span>
              <span className="text-white font-semibold">{totalOrderValue ? `₹${totalOrderValue.toFixed(2)}` : '—'}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-2">
            <button onClick={handleConfirm} className={`flex-1 p-3 rounded-lg text-white font-semibold ${actionTab === 'Buy' ? 'bg-green-600' : 'bg-red-600'}`}>
              {actionTab === 'Buy' ? 'Confirm Buy' : 'Confirm Sell'}
            </button>
            <button onClick={() => setSelectedStock(null)} className="p-3 rounded-lg bg-[#333846] text-gray-200 font-medium">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Summery;
