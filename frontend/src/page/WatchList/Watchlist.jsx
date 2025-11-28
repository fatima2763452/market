import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2 } from "lucide-react";
import BottomWindow from "./BottomWindow/BottomWindow";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";
// Framer Motion Import
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import Toast from '../../Utils/Toast.jsx'


// --- Index Card (Same as before) ---
const IndexCard = ({ name, price, change, isPositive }) => {
  const [flashColor, setFlashColor] = useState("");
  const prevPriceRef = useRef(price);

  useEffect(() => {
    // Basic validation check
    if (!price || price === "—") return;

    // Convert string/number to float for comparison
    const currentP = parseFloat(price);
    const prevP = parseFloat(prevPriceRef.current);

    // Check if numbers are valid and price has actually changed
    if (!isNaN(currentP) && !isNaN(prevP) && currentP !== prevP) {
      if (currentP > prevP) {
        // Price Badha -> Green Flash
        setFlashColor("text-green-500 scale-105"); // scale-105 thoda pop effect dega
      } else {
        // Price Ghata -> Red Flash
        setFlashColor("text-red-500 scale-105");
      }

      // 300ms baad flash hata do
      const timer = setTimeout(() => {
        setFlashColor("");
      }, 300);

      // Ref update karo current price ke sath
      prevPriceRef.current = price;

      return () => clearTimeout(timer);
    } else {
      // First render ya same price par ref update
      prevPriceRef.current = price;
    }
  }, [price]);


  const defaultColor = isPositive ? "text-green-400" : "text-red-400";
  
  const priceColor = flashColor || defaultColor;

  // Arrow icon logic    
  const arrow = isPositive ? "▲" : "▼";

  return (
    <div className="flex-1 bg-[#121a2b] border border-white/10 p-3 rounded-lg mx-1">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-white font-semibold text-sm md:text-base">{name}</p>
          <p className="text-gray-400 text-[10px] md:text-xs">Index</p>
        </div>
        <div className="text-right">
          {/* Price with Flash Effect */}
          <p 
            className={`font-bold text-sm md:text-base transition-all duration-200 ${priceColor}`}
          >
            {price}
          </p>
          
          {/* Percentage Change */}
          <p className={`text-[10px] md:text-xs font-medium ${defaultColor}`}>
            {arrow} {change}%
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Swipeable Watchlist Item ---
const SwipeableWatchlistItem = ({
  item, priceData, onClick, onRemove
}) => {
  // Destructure price data
  const { ltp, netChange, percentChange, isPositive, volume, close } = priceData;
  
  const priceColor = isPositive === true ? "text-green-400" : isPositive === false ? "text-red-400" : "text-gray-400";
  const formattedPrice = ltp == null ? "—" : `₹${Number(ltp).toFixed(2)}`;
  const formattedNetChange = netChange == null ? "—" : `${netChange > 0 ? "+" : ""}${Number(netChange).toFixed(2)}`;
  const formattedPercentChange = percentChange == null ? "—" : `(${percentChange > 0 ? "+" : ""}${Number(percentChange).toFixed(2)}%)`;
  const formattedVolume = volume ? `${(Number(volume) / 100000).toFixed(2)}L` : "—";
  const formattedClose = close ? `Close: ₹${Number(close).toFixed(2)}` : ""; 

  // Motion values for swipe effect
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, -50], [1, 0]); // Fade icon based on drag
  const bgOpacity = useTransform(x, [-100, 0], [1, 0]); // Background redness

  return (
    <div className="relative overflow-hidden rounded-lg mb-2">
      {/* Background Layer (Red with Delete Icon) */}
      <motion.div 
        style={{ opacity: bgOpacity }}
        className="absolute inset-y-0 right-0 w-full bg-red-600/20 rounded-lg flex items-center justify-end pr-6 z-0"
      >
        <Trash2 className="text-red-500 w-6 h-6" />
      </motion.div>

      {/* Foreground Layer (The Actual Item) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }} // Only allows dragging left
        dragElastic={{ left: 0.5, right: 0 }} // Elastic feel
        onDragEnd={(e, { offset, velocity }) => {
          // Trigger delete if swiped left more than 100px
          if (offset.x < -100) {
            onRemove(item);
          }
        }}
        whileTap={{ cursor: "grabbing" }}
        style={{ x, backgroundColor: "#121a2b" }}
        className="relative z-10 border border-white/10 p-3 rounded-lg hover:bg-[#172238] transition-colors cursor-pointer"
        onClick={() => {
            // Prevent click if user was dragging
            if (x.get() === 0) onClick();
        }}
      >
        <div className="flex justify-between items-center w-full pointer-events-none"> {/* pointer-events-none helps drag work smoothly on text */}
          <div>
            <span className="font-medium text-white/90 block">{item.tradingSymbol}</span>
            <span className="text-xs text-gray-400 block mt-0.5">{item.exchange}</span>
          </div>
          <div className="text-right">
            <span className={`font-semibold text-lg block ${priceColor}`}>{formattedPrice}</span>
            <span className={`text-xs block ${priceColor}`}>{formattedNetChange} {formattedPercentChange}</span>
            <div className="flex justify-end space-x-2">
              <span className="text-xs text-gray-400 block">Vol: {formattedVolume}</span>
              <span className="text-xs text-gray-400 block">{formattedClose}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};


function Watchlist() {
  // ... (State and Context logic same as before)
  const token = (typeof window !== "undefined" && localStorage.getItem("token")) || null;
  const { ticks, subscribe, unsubscribe, isConnected } = useMarketData();
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const [stocks, setStocks] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [actionTab, setActionTab] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState("");
  const [indexInstruments, setIndexInstruments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const openedInstrumentRef = useRef(null);
  const isUpgradingRef = useRef(false);

  // *** Toast State ***
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });

  const showToast = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 2500); // 2.5s fast toast
  };

  // ... (formatInstruments function same)
  const formatInstruments = (instruments) => {
    if (!Array.isArray(instruments)) return [];
    return instruments.map(one => ({
      id: `${one.segment}-${one.securityId}-${one.expiry || "na"}`,
      tradingSymbol: one.display_name || one.tradingsymbol || one.symbol_name || "Unknown",
      exchange: one.segment === "MCX_COMM" ? "MCX" : "NSE",
      segment: one.segment,
      securityId: String(one.securityId),
      expiry: one.expiry || null,
      lotSize: one.lotSize ?? null,
      canonKey: one.canon_key,
    }));
  };

  // ... (subscribeAndSnapshot, handleUpgradeToFull, handleDowngradeToQuote - SAME AS BEFORE)
  const subscribeAndSnapshot = useCallback(async (instrumentList, subscriptionType = 'full') => {
    if (!instrumentList || instrumentList.length === 0) return;
    const subs = instrumentList.map(p => ({ segment: p.segment, securityId: p.securityId }));
    try { await subscribe(subs, subscriptionType); } catch (e) { console.warn(e); }
    try {
      const r = await fetch(`${apiBase}/api/quotes/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ items: subs }),
      });
      const map = r.ok ? await r.json() : {};
      setSnapshots(prev => ({ ...prev, ...map }));
    } catch (e) { console.warn(e); }
  }, [subscribe, apiBase, token]);

  const handleUpgradeToFull = useCallback(async (instrument) => {
    if (!instrument || isUpgradingRef.current) return;
    const instrumentKey = `${instrument.segment}-${instrument.securityId}`;
    if (openedInstrumentRef.current?.key === instrumentKey) return;
    isUpgradingRef.current = true;
    const sub = [{ segment: instrument.segment, securityId: instrument.securityId }];
    try { await unsubscribe(sub, 'quote'); } catch (e) {}
    try {
      await subscribe(sub, 'full');
      openedInstrumentRef.current = { ...instrument, key: instrumentKey };
    } catch (e) {}
    try {
      const r = await fetch(`${apiBase}/api/quotes/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ items: sub }),
      });
      const map = r.ok ? await r.json() : {};
      setSnapshots(prev => ({ ...prev, ...map }));
    } catch (e) {} finally { isUpgradingRef.current = false; }
  }, [subscribe, unsubscribe, apiBase, token]);

  const handleDowngradeToQuote = useCallback(async () => {
    const instrument = openedInstrumentRef.current;
    if (!instrument) return;
    const sub = [{ segment: instrument.segment, securityId: instrument.securityId }];
    try { await unsubscribe(sub, 'full'); } catch (e) {}
    try { await subscribe(sub, 'quote'); openedInstrumentRef.current = null; } catch (e) {}
  }, [subscribe, unsubscribe]);


  // *** UPDATED: REMOVE FUNCTION (Optimistic UI) ***
  const handleRemoveFromWatchlist = useCallback(async (stock) => {
    if (!stock || !stock.securityId) return;

    // 1. Immediately remove from UI (Optimistic Update) - "Thoda jaldi aana chahiye"
    setStocks(prev => prev.filter(s => s.id !== stock.id));
    
    // 2. Show Toast Immediately
    showToast(`Stock removed successfully`, "success");

    // 3. Close bottom window if selected
    if (selectedStock?.id === stock.id) setSelectedStock(null);

    // 4. Perform API Call in Background
    try {
      const canonKey = stock.canonKey || `${stock.exchange}|${stock.segment}|${stock.securityId}`;
      const activeContextString = localStorage.getItem('activeContext');
      const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
      const brokerId = activeContext.brokerId;
      const customerId = activeContext.customerId;

      const response = await fetch(
        `${apiBase}/api/watchlist/${encodeURIComponent(canonKey)}?broker_id_str=${brokerId}&customer_id_str=${customerId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Unsubscribe (Cleanup)
      const sub = [{ segment: stock.segment, securityId: stock.securityId }];
      unsubscribe(sub, 'quote').catch(console.warn);

      if (!response.ok) {
        // If API fails, silently log or add back (usually not needed for watchlist unless critical)
        console.error("API failed to remove, but UI updated.");
      }
    } catch (error) {
      console.error("Failed to remove from watchlist:", error);
    }
  }, [apiBase, token, unsubscribe, selectedStock]);


  // ... (Initial load useEffect - SAME AS BEFORE)
  useEffect(() => {
    if (!isConnected || loadingRef.current) return;
    loadingRef.current = true;
    const loadAllInstruments = async () => {
      try {
        setIsLoading(true);
        const nifty50Res = await fetch(`${apiBase}/api/instruments/search?q=Nifty 50&category=NSE_INDEX`, { credentials: "include" }).then(res => res.json());
        const bankNiftyRes = await fetch(`${apiBase}/api/instruments/search?q=Nifty Bank&category=NSE_INDEX`, { credentials: "include" }).then(res => res.json());
        const nifty50Inst = nifty50Res.find(i => (i.display_name === "Nifty 50" || i.tradingsymbol === "Nifty 50") && i.segment === "NSE_INDEX");
        const bankNiftyInst = bankNiftyRes.find(i => (i.display_name === "Nifty Bank" || i.tradingsymbol === "Nifty Bank") && i.segment === "NSE_INDEX");
        const indexInstrumentsRaw = [nifty50Inst, bankNiftyInst].filter(Boolean);
        const formattedIndexes = formatInstruments(indexInstrumentsRaw);
        setIndexInstruments(formattedIndexes);

        const activeContextString = localStorage.getItem('activeContext');
        const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
        const brokerId = activeContext.brokerId;
        const customerId = activeContext.customerId;

        const response = await fetch(`${apiBase}/api/watchlist/getWatchlist?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch watchlist");
        const payload = await response.json();
        const instrumentsArr = Array.isArray(payload) ? payload : (payload?.instruments || []);
        const formattedWatchlist = formatInstruments(instrumentsArr);
        const uniqueWatchlist = Array.from(new Map(formattedWatchlist.map(item => [item.id ?? item._id ?? item.securityId, item])).values());
        
        setStocks(uniqueWatchlist);
        if (formattedIndexes.length > 0) await subscribeAndSnapshot(formattedIndexes, 'quote');
        if (uniqueWatchlist.length > 0) await subscribeAndSnapshot(uniqueWatchlist, 'quote');
      } catch (e) {
        console.error("Failed to load:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllInstruments();
  }, [isConnected, apiBase, token, subscribeAndSnapshot]);

  const segmentStringToNumberMap = useMemo(() => ({ "IDX_I": 0, "NSE_EQ": 1, "NSE_FNO": 2, "NSE_CURRENCY": 3, "BSE_EQ": 4, "BSE_CURRENCY": 5, "MCX_COMM": 5, "NSE_INDEX": 0 }), []);

  // ... (prices useMemo - SAME AS BEFORE)
  const prices = useMemo(() => {
    const byId = {};
    const num = (v) => (v == null || v === "" ? null : Number(v));
    stocks.forEach((s) => {
      const numericSegment = segmentStringToNumberMap[s.segment];
      const tickKey = `${numericSegment}-${s.securityId}`;
      const snapKey = String(s.securityId);
      const snap = snapshots[snapKey] || {};
      const t = ticks.get(tickKey) || {};
      const combined = { ...snap, ...t };
      const ltp = num(combined.ltp);
      const open = num(combined.open);
      const high = num(combined.dayHigh) ?? num(combined.high);
      const low = num(combined.dayLow) ?? num(combined.low);
      const close = num(combined.close);
      const volume = num(combined.volume);
      const oi = num(combined.oi) ?? num(combined.openInterest);
      let percentChange = num(combined.percentChange);
      if (percentChange == null && ltp != null) {
        if (close != null && close !== 0) percentChange = ((ltp - close) / close) * 100;
        else if (open != null && open !== 0) percentChange = ((ltp - open) / open) * 100;
      }
      let netChange = num(combined.netChange);
      if (netChange == null && ltp != null) {
        if (percentChange != null) netChange = (ltp * (percentChange / 100));
        else if (close != null) netChange = ltp - close;
        else if (open != null) netChange = ltp - open;
      }
      byId[s.id] = {
        ltp, netChange, percentChange,
        isPositive: netChange != null ? netChange >= 0 : (percentChange != null ? percentChange >= 0 : null),
        open, high, low, close, volume, oi,
        bestBidPrice: num(combined.bestBidPrice), bestBidQuantity: num(combined.bestBidQuantity),
        bestAskPrice: num(combined.bestAskPrice), bestAskQuantity: num(combined.bestAskQuantity),
        lastTradeQty: num(combined.lastTradeQty), lastTradeTime: combined.lastTradeTime, depth: combined.depth || null,
      };
    });
    return byId;
  }, [ticks, snapshots, stocks, segmentStringToNumberMap]);

  useEffect(() => {
    if (!selectedStock) return;
    const p = prices[selectedStock.id] || {};
    setOrderPrice(p?.ltp != null ? Number(p.ltp).toFixed(2) : "");
    setQuantity(1);
  }, [selectedStock, prices]);

  useEffect(() => {
    if (selectedStock) handleUpgradeToFull(selectedStock);
    else if (openedInstrumentRef.current) handleDowngradeToQuote();
  }, [selectedStock]);

  const sheetData = selectedStock ? prices[selectedStock.id] || {} : {};

  // ... (indexPrices useMemo and Index vars - SAME AS BEFORE)
  const indexPrices = useMemo(() => {
    const byId = {};
    const num = (v) => (v == null || v === "" ? null : Number(v));
    indexInstruments.forEach((s) => {
      const numericSegment = segmentStringToNumberMap[s.segment];
      const tickKey = `${numericSegment}-${s.securityId}`;
      const snapKey = String(s.securityId);
      let snap = snapshots[snapKey] || {};
      let t = ticks.get(tickKey) || {};
      if (t.exchangeSegment !== undefined && t.exchangeSegment !== numericSegment) t = {};
      if (snap.exchangeSegment !== undefined && snap.exchangeSegment !== numericSegment) snap = {};
      const ltp = num(t.ltp) ?? num(snap.ltp);
      const open = num(t.open) ?? num(snap.open);
      const close = num(t.close) ?? num(snap.close);
      let percentChange = (t.percentChange != null ? num(t.percentChange) : snap.percentChange != null ? num(snap.percentChange) : null);
      if (percentChange == null && ltp != null) {
        if (close != null && close !== 0) percentChange = ((ltp - close) / close) * 100;
        else if (open != null && open !== 0) percentChange = ((ltp - open) / open) * 100;
      }
      let netChange = (t.netChange != null ? num(t.netChange) : snap.netChange != null ? num(snap.netChange) : null);
      if (netChange == null && ltp != null) {
        if (percentChange != null) netChange = (ltp * percentChange) / 100;
        else if (close != null) netChange = ltp - close;
        else if (open != null) netChange = ltp - open;
      }
      byId[s.id] = { ltp, netChange, percentChange, isPositive: netChange != null ? netChange >= 0 : (percentChange != null ? percentChange >= 0 : null), };
    });
    return byId;
  }, [ticks, snapshots, indexInstruments, segmentStringToNumberMap]);

  const bankNiftyInst = indexInstruments.find(i => i.tradingSymbol === "Nifty Bank");
  const nifty50Inst = indexInstruments.find(i => i.tradingSymbol === "Nifty 50");
  const bankNiftyPrice = bankNiftyInst ? indexPrices[bankNiftyInst.id] : {};
  const nifty50Price = nifty50Inst ? indexPrices[nifty50Inst.id] : {};

  return (
    <div className="w-full h-full bg-[#0b1020] md:w-1/2 lg:w-3/12 md:border-r border-white/10 flex flex-col relative min-h-0">
      
      {/* Toast Notification */}
      <Toast message={notification.message} type={notification.type} show={notification.show} />

      {/* Header */}
      <div className="pt-3 pb-2 px-4 mb-0 border-b border-white/10 sticky top-0 bg-[#0b1020] z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
              <span className="text-white font-bold text-lg font-sans">D</span>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-white tracking-wide leading-none">DEVAKI</h3>
              <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-0.5">Terminal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Index Cards */}
      <div className="px-2 pb-2 pt-2 flex sticky top-[64px] bg-[#0b1020] z-10 border-b border-white/10 mt-0">
        <IndexCard name="NIFTY BANK" price={bankNiftyPrice?.ltp?.toFixed(2) || "—"} change={bankNiftyPrice?.percentChange?.toFixed(2) || "—"} isPositive={bankNiftyPrice?.isPositive} />
        <IndexCard name="Nifty" price={nifty50Price?.ltp?.toFixed(2) || "—"} change={nifty50Price?.percentChange?.toFixed(2) || "—"} isPositive={nifty50Price?.isPositive} />
      </div>

      {/* Search Button */}
      <div className="p-2 sticky top-[150px] bg-[#0b1020] z-10 border-b border-white/10">
        <Link to="/search" className="flex items-center gap-3 w-full bg-[#121a2b] hover:bg-[#1a2438] border border-white/10 text-gray-400 px-3 py-2.5 rounded-lg transition-all duration-200 group">
          <Search size={18} className="group-hover:text-white transition-colors" />
          <span className="text-sm font-medium group-hover:text-white transition-colors">Search & add instruments...</span>
        </Link>
      </div>

      {/* Swipeable List */}
      <ul className="space-y-0 p-2 flex-1 overflow-y-auto pb-28 min-h-0 mt-0">
        <AnimatePresence>
          {stocks.map((stock) => {
            const p = prices[stock.id] || {};
            return (
              <motion.div
                key={stock.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginLeft: -100 }} // Slide out animation
                transition={{ duration: 0.2 }}
              >
                <SwipeableWatchlistItem
                  item={stock}
                  priceData={p}
                  onClick={() => { setSelectedStock(stock); setActionTab("Buy"); }}
                  onRemove={handleRemoveFromWatchlist}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty State */}
        {stocks.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-8 px-4 text-center">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
                <p className="text-gray-400">Loading instruments…</p>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 text-gray-600 mb-3" />
                <h3 className="text-white font-semibold text-lg mb-2">Your Watchlist is Empty</h3>
                <p className="text-gray-400 text-sm mb-4">Search above to add stocks</p>
              </>
            )}
          </div>
        )}
      </ul>

      <BottomWindow
        selectedStock={selectedStock}
        sheetData={sheetData}
        actionTab={actionTab}
        setActionTab={setActionTab}
        quantity={quantity}
        setQuantity={setQuantity}
        orderPrice={orderPrice}
        setOrderPrice={setOrderPrice}
        setSelectedStock={setSelectedStock}
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
        subscriptionType="full"
      />
    </div>
  );
}

export default Watchlist;