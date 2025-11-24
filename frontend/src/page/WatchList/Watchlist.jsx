import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2 } from "lucide-react";
import BottomWindow from "./BottomWindow/BottomWindow";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";

// Small stat card
const IndexCard = ({ name, price, change, isPositive }) => {
  const changeColor = isPositive ? "text-green-400" : "text-red-400";
  const arrow = isPositive ? "▲" : "▼";
  return (
    <div className="flex-1 bg-[#121a2b] border border-white/10 p-3 rounded-lg mx-1">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-white font-semibold">{name}</p>
          <p className="text-gray-400 text-xs">Index</p>
        </div>
        <div className="text-right">
          <p className="text-white/90 font-medium">{price}</p>
          <p className={`${changeColor} text-sm`}>{arrow} {change}%</p>
        </div>
      </div>
    </div>
  );
};

const WatchlistItem = ({
  name, exchange, price, netChange, percentChange, isPositive, volume, close, onClick,
}) => {
  const priceColor =
    isPositive === true ? "text-green-400"
      : isPositive === false ? "text-red-400"
        : "text-gray-400";

  const formattedPrice = price == null ? "—" : `₹${Number(price).toFixed(2)}`;
  const formattedNetChange =
    netChange == null ? "—"
      : `${netChange > 0 ? "+" : ""}${Number(netChange).toFixed(2)}`;
  const formattedPercentChange =
    percentChange == null ? "—"
      : `(${percentChange > 0 ? "+" : ""}${Number(percentChange).toFixed(2)}%)`;
  const formattedVolume = volume ? `${(Number(volume) / 100000).toFixed(2)}L` : "—";
  const formattedClose = close ? `Close: ₹${Number(close).toFixed(2)}` : "";

  return (
    <li
      onClick={onClick}
      className="bg-[#121a2b] border border-white/10 p-3 rounded-lg hover:bg-[#172238] transition duration-150 cursor-pointer"
    >
      <div className="flex justify-between items-center w-full">
        <div>
          <span className="font-medium text-white/90 block">{name}</span>
          <span className="text-xs text-gray-400 block mt-0.5">{exchange}</span>
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
    </li>
  );
};

function Watchlist() {
  useEffect(() => {
    console.log("--- [Watchlist.jsx] Component MOUNTED ---");
    return () => {
      console.log("--- [Watchlist.jsx] Component UNMOUNTING ---");
    };
  }, []);

  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) ||
    null;

  // Use shared socket connection from context
  const { ticks, subscribe, unsubscribe, isConnected } = useMarketData();

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const [stocks, setStocks] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [actionTab, setActionTab] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState("");
  const [indexInstruments, setIndexInstruments] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const loadingRef = useRef(false);

  // Track the instrument that's currently opened in BottomWindow for subscription upgrade/downgrade
  const openedInstrumentRef = useRef(null);
  const isUpgradingRef = useRef(false); // Prevent multiple upgrades



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
      canonKey: one.canon_key, // Store canon_key for deletion
    }));
  };

  const subscribeAndSnapshot = useCallback(async (instrumentList, subscriptionType = 'full') => {
    if (!instrumentList || instrumentList.length === 0) return;

    const subs = instrumentList.map(p => ({
      segment: p.segment,
      securityId: p.securityId
    }));

    // first attempt to subscribe (socket)
    try {
      await subscribe(subs, subscriptionType);
    } catch (e) {
      console.warn("subscribe failed:", e?.message || e);
    }

    // then try to fetch snapshot; if it fails we still set results so UI shows them
    try {
      const r = await fetch(`${apiBase}/api/quotes/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ items: subs }),
      });
      const map = r.ok ? await r.json() : {};
      setSnapshots(prev => ({ ...prev, ...map }));
    } catch (e) {
      console.warn("snapshot fetch failed:", e?.message || e);
    }
  }, [subscribe, apiBase, token]);

  // Upgrade subscription from 'quote' to 'full' when BottomWindow opens
  const handleUpgradeToFull = useCallback(async (instrument) => {
    if (!instrument || isUpgradingRef.current) return;
    
    // Prevent duplicate calls
    const instrumentKey = `${instrument.segment}-${instrument.securityId}`;
    if (openedInstrumentRef.current?.key === instrumentKey) {
      console.log("[Watchlist] Already upgraded, skipping");
      return;
    }

    isUpgradingRef.current = true;
    console.log("[Watchlist] Upgrading subscription to 'full' for:", instrument.tradingSymbol);
    // console.log("[Watchlist] Upgrading subscription to 'full' for:", instrument.lotSize);

    const sub = [{
      segment: instrument.segment,
      securityId: instrument.securityId
    }];

    // Step 1: Unsubscribe from 'quote'
    try {
      await unsubscribe(sub, 'quote');
      console.log("[Watchlist] Unsubscribed from 'quote'");
    } catch (e) {
      console.warn("[Watchlist] Failed to unsubscribe from quote:", e?.message || e);
    }

    // Step 2: Subscribe to 'full'
    try {
      await subscribe(sub, 'full');
      console.log("[Watchlist] Subscribed to 'full'");
      openedInstrumentRef.current = { ...instrument, key: instrumentKey };
    } catch (e) {
      console.warn("[Watchlist] Failed to subscribe to full:", e?.message || e);
    }

    // Step 3: Fetch fresh snapshot with full data
    try {
      const r = await fetch(`${apiBase}/api/quotes/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ items: sub }),
      });
      const map = r.ok ? await r.json() : {};
      setSnapshots(prev => ({ ...prev, ...map }));
    } catch (e) {
      console.warn("[Watchlist] snapshot fetch failed:", e?.message || e);
    } finally {
      isUpgradingRef.current = false;
    }
  }, [subscribe, unsubscribe, apiBase, token]);

  // Downgrade subscription from 'full' back to 'quote' when BottomWindow closes
  const handleDowngradeToQuote = useCallback(async () => {
    const instrument = openedInstrumentRef.current;
    if (!instrument) return;

    console.log("[Watchlist] Downgrading subscription to 'quote' for:", instrument.tradingSymbol);

    const sub = [{
      segment: instrument.segment,
      securityId: instrument.securityId
    }];

    // Step 1: Unsubscribe from 'full'
    try {
      await unsubscribe(sub, 'full');
      console.log("[Watchlist] Unsubscribed from 'full'");
    } catch (e) {
      console.warn("[Watchlist] Failed to unsubscribe from full:", e?.message || e);
    }

    // Step 2: Re-subscribe to 'quote'
    try {
      await subscribe(sub, 'quote');
      console.log("[Watchlist] Re-subscribed to 'quote'");
      openedInstrumentRef.current = null;
    } catch (e) {
      console.warn("[Watchlist] Failed to re-subscribe to quote:", e?.message || e);
    }
  }, [subscribe, unsubscribe]);

  // Handle removing stock from watchlist
  const handleRemoveFromWatchlist = useCallback(async (stock) => {
    if (!stock || !stock.securityId) {
      console.error("Cannot remove stock, securityId is missing.");
      return;
    }

    try {
      // Use canon_key if available, otherwise construct it
      // canon_key format from backend: exchange|segment|securityId (e.g., "NSE|NSE_FNO|49081")
      const canonKey = stock.canonKey || `${stock.exchange}|${stock.segment}|${stock.securityId}`;
      console.log('[Watchlist] Removing stock with canonKey:', canonKey);
      
      const response = await fetch(`${apiBase}/api/watchlist/${encodeURIComponent(canonKey)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        console.log(`${stock.tradingSymbol} removed from watchlist!`);
        
        // Unsubscribe from this instrument
        const sub = [{
          segment: stock.segment,
          securityId: stock.securityId
        }];
        try {
          await unsubscribe(sub, 'quote');
        } catch (e) {
          console.warn("Failed to unsubscribe:", e);
        }
        
        // Remove from local state
        setStocks(prev => prev.filter(s => s.id !== stock.id));
        
        // Close BottomWindow if this stock was selected
        if (selectedStock?.id === stock.id) {
          setSelectedStock(null);
        }
      } else {
        const errorData = await response.json();
        console.error(`Failed to remove from watchlist: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Failed to remove from watchlist:", error);
    }
  }, [apiBase, token, unsubscribe, selectedStock]);

  // initial load (wait for socket connection)
  useEffect(() => {
    if (!isConnected || loadingRef.current) return;
    loadingRef.current = true;

    const loadAllInstruments = async () => {
      try {
        setIsLoading(true); // Start loading
        
        // Index instruments
        const nifty50Res = await fetch(`${apiBase}/api/instruments/search?q=Nifty 50&category=NSE_INDEX`, { credentials: "include" }).then(res => res.json());
        const bankNiftyRes = await fetch(`${apiBase}/api/instruments/search?q=Nifty Bank&category=NSE_INDEX`, { credentials: "include" }).then(res => res.json());

        const nifty50Inst = nifty50Res.find(i => (i.display_name === "Nifty 50" || i.tradingsymbol === "Nifty 50") && i.segment === "NSE_INDEX");
        const bankNiftyInst = bankNiftyRes.find(i => (i.display_name === "Nifty Bank" || i.tradingsymbol === "Nifty Bank") && i.segment === "NSE_INDEX");
        const indexInstrumentsRaw = [nifty50Inst, bankNiftyInst].filter(Boolean);
        const formattedIndexes = formatInstruments(indexInstrumentsRaw);
        setIndexInstruments(formattedIndexes);

        // Watchlist from DB for the user
        const response = await fetch(`${apiBase}/api/watchlist`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch watchlist instruments");
        const instrumentsFromDb = await response.json();
        const formattedWatchlist = formatInstruments(instrumentsFromDb);
        const uniqueWatchlist = Array.from(new Map(formattedWatchlist.map(p => [p.id, p])).values());
        setStocks(uniqueWatchlist);

        if (formattedIndexes.length > 0) {
          await subscribeAndSnapshot(formattedIndexes, 'quote');
        }
        if (uniqueWatchlist.length > 0) {
          // Subscribe to 'quote' for list view (LTP, volume, close, %change)
          await subscribeAndSnapshot(uniqueWatchlist, 'quote');
        }
      } catch (e) {
        console.error("Failed to load initial instruments:", e);
      } finally {
        setIsLoading(false); // Done loading
      }
    };

    loadAllInstruments();
  }, [isConnected, apiBase, token, subscribeAndSnapshot]);

  const segmentStringToNumberMap = useMemo(() => ({
    "IDX_I": 0,
    "NSE_EQ": 1,
    "NSE_FNO": 2,
    "NSE_CURRENCY": 3,
    "BSE_EQ": 4,
    "BSE_CURRENCY": 5,
    "MCX_COMM": 5,
    "NSE_INDEX": 0,
  }), []);

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
        if (close != null && close !== 0) {
          percentChange = ((ltp - close) / close) * 100;
        } else if (open != null && open !== 0) {
          percentChange = ((ltp - open) / open) * 100;
        }
      }

      let netChange = num(combined.netChange);
      if (netChange == null && ltp != null) {
        if (percentChange != null) netChange = (ltp * (percentChange / 100));
        else if (close != null) netChange = ltp - close;
        else if (open != null) netChange = ltp - open;
      }

      byId[s.id] = {
        ltp, netChange, percentChange,
        isPositive:
          netChange != null ? netChange >= 0 :
            (percentChange != null ? percentChange >= 0 : null),

        open, high, low, close, volume, oi,
        bestBidPrice: num(combined.bestBidPrice),
        bestBidQuantity: num(combined.bestBidQuantity),
        bestAskPrice: num(combined.bestAskPrice),
        bestAskQuantity: num(combined.bestAskQuantity),
        lastTradeQty: num(combined.lastTradeQty),
        lastTradeTime: combined.lastTradeTime,
        
        // Include depth data for Market Depth view (from Full Packet)
        depth: combined.depth || null,
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

  // Handle subscription upgrade/downgrade when BottomWindow opens/closes
  useEffect(() => {
    if (selectedStock) {
      // User clicked an instrument - upgrade to 'full'
      handleUpgradeToFull(selectedStock);
    } else {
      // User closed BottomWindow - downgrade back to 'quote'
      if (openedInstrumentRef.current) {
        handleDowngradeToQuote();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock]); // Only depend on selectedStock, not the functions

  const sheetData = selectedStock ? prices[selectedStock.id] || {} : {};

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

      byId[s.id] = {
        ltp, netChange, percentChange,
        isPositive: netChange != null ? netChange >= 0 : (percentChange != null ? percentChange >= 0 : null),
      };
    });
    return byId;
  }, [ticks, snapshots, indexInstruments, segmentStringToNumberMap]);

  const bankNiftyInst = indexInstruments.find(i => i.tradingSymbol === "Nifty Bank");
  const nifty50Inst = indexInstruments.find(i => i.tradingSymbol === "Nifty 50");
  const bankNiftyPrice = bankNiftyInst ? indexPrices[bankNiftyInst.id] : {};
  const nifty50Price = nifty50Inst ? indexPrices[nifty50Inst.id] : {};

  return (
    <div className="w-full h-full bg-[#0b1020] md:w-1/2 lg:w-3/12 md:border-r border-white/10 flex flex-col relative">
      <div className="p-4 text-white/90 border-b border-white/10 sticky top-0 bg-[#0b1020] z-20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">Watchlist</h2>
          <Link to="/search" className="text-white/80 hover:text-white">
            <Search size={24} />
          </Link>
        </div>
      </div>

      <div className="p-2 flex sticky top-[88px] bg-[#0b1020] z-10 border-b border-white/10">
        <IndexCard 
          name="NIFTY BANK" 
          price={bankNiftyPrice?.ltp?.toFixed(2) || "—"} 
          change={bankNiftyPrice?.percentChange?.toFixed(2) || "—"} 
          isPositive={bankNiftyPrice?.isPositive} 
        />
        <IndexCard 
          name="Nifty" 
          price={nifty50Price?.ltp?.toFixed(2) || "—"} 
          change={nifty50Price?.percentChange?.toFixed(2) || "—"} 
          isPositive={nifty50Price?.isPositive} 
        />
      </div> */

      <ul className="space-y-2 text-sm md:text-base p-2 flex-grow overflow-y-auto">
        {stocks.map((stock) => {
          // console.log(`lot size in ------------ ${stock.lotSize}`)
          const p = prices[stock.id] || {};
          
          return (
            <WatchlistItem
              key={stock.id}
              name={stock.tradingSymbol}
              exchange={stock.exchange || "—"}
              price={p.ltp}
              netChange={p.netChange}
              percentChange={p.percentChange}
              isPositive={p.isPositive}
              volume={p.volume}
              close={p.close}
              onClick={() => { setSelectedStock(stock); setActionTab("Buy"); }}
            />
          );
        })}

        {(stocks.length === 0) && (
          <div className="flex flex-col items-center justify-center pt-8 px-4 text-center">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
                <p className="text-gray-400">Loading instruments…</p>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 text-gray-600 mb-3" />
                <h3 className="text-white font-semibold text-lg mb-2">Your Watchlist is Empty</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Search and add your favourite stocks to get started
                </p>
                <Link 
                  to="/search"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  Add Stocks
                </Link>
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