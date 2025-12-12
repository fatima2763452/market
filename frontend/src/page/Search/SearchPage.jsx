import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import SearchBar from "../WatchList/SearchBar";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";
import { CheckCircle, XCircle } from "lucide-react"; // Agar lucide-react nahi hai to ise hata kar simple text use kar sakte hain

// --- Memoized List Item Component ---
const WatchlistItem = React.memo(({ name, exchange, onClick, ltp, percentChange }) => {
  const priceColor = percentChange == null ? "text-[var(--text-secondary)]" : percentChange >= 0 ? "text-green-400" : "text-red-400";
  const formattedLtp = ltp != null ? `₹${ltp.toFixed(2)}` : "—";
  const formattedPercent = percentChange != null ? `${percentChange >= 0 ? "▲" : "▼"} ${Math.abs(percentChange).toFixed(2)}%` : "—";

  return (
    <li
      onClick={onClick}
      className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-lg hover:bg-[var(--bg-hover)] transition duration-150 cursor-pointer"
    >
      <div className="flex justify-between items-center w-full">
        <div>
          <span className="font-medium text-[var(--text-primary)] opacity-90 block">{name}</span>
          <span className="text-xs text-[var(--text-secondary)] block mt-0.5">{exchange}</span>
        </div>
        <div className="text-right">
          <span className={`block text-sm font-semibold ${priceColor}`}>{formattedLtp}</span>
          <span className={`block text-xs ${priceColor}`}>{formattedPercent}</span>
        </div>
      </div>
    </li>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props actually changed
  return (
    prevProps.name === nextProps.name &&
    prevProps.exchange === nextProps.exchange &&
    prevProps.ltp === nextProps.ltp &&
    prevProps.percentChange === nextProps.percentChange
  );
});

// --- Main Search Page ---
function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchSnapshots, setSearchSnapshots] = useState({});
  const [isSearching, setIsSearching] = useState(false);

  // *** Notification State ***
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });

  const searchSubscriptionsRef = useRef([]);
  const activeAbortControllerRef = useRef(null);

  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) ||
    null;

  const { ticksRef, subscribe, unsubscribe } = useMarketData();
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:8080";

  // *** Helper to show notification ***
  const showToast = (message, type = "success") => {
    setNotification({ show: true, message, type });
    // 3 seconds baad apne aap gayab ho jayega
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  };

  const searchApi = useMemo(
    () => ({
      search: async (q, signal) => {
        // ==================== FRONTEND SEARCH CACHE ====================
        const cacheKey = `search_${q.toLowerCase()}`;
        const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

        try {
          const cached = sessionStorage.getItem(cacheKey);
          const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

          if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            if (age < CACHE_TTL) {
              console.log(`[Search Cache] Using cached results for "${q}" (${Math.round(age / 1000)}s old)`);
              return JSON.parse(cached);
            }
          }
        } catch (e) {
          // Cache read failed, proceed with fetch
        }
        // ==================== END FRONTEND SEARCH CACHE ====================

        const url = `${apiBase}/api/instruments/search?q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { credentials: "include", signal });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`search failed: ${q} status:${r.status} ${text}`);
        }
        const data = await r.json();
        const results = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

        // Cache the results
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(results));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        } catch (e) {
          // Cache write failed (probably quota exceeded), continue without caching
          console.warn('[Search Cache] Failed to cache results:', e);
        }

        return results;
      },
    }),
    [apiBase]
  );

  // Helper function to get proper exchange display name based on segment and instrument type
  const getExchangeDisplayName = (segment, instrumentType) => {
    if (segment === 'NSE_EQ' || segment === 'BSE_EQ') return 'NSE Equity';
    if (segment === 'NSE_INDEX') return 'NSE Index';
    if (segment === 'BSE_INDEX') return 'BSE Index';
    if (segment === 'NSE_FNO') {
      if (['FUTIDX', 'FUTSTK'].includes(instrumentType)) return 'NSE Futures';
      if (['OPTIDX', 'OPTSTK'].includes(instrumentType)) return 'NSE Options';
      return 'NSE F&O';
    }
    if (segment === 'BSE_FNO') {
      if (instrumentType === 'FUTIDX') return 'BSE Index Futures';
      if (instrumentType === 'OPTIDX') return 'BSE Index Options';
      return 'BSE F&O';
    }
    if (segment === 'MCX_COMM') {
      if (instrumentType === 'FUTCOM') return 'MCX Futures';
      if (instrumentType === 'OPTFUT') return 'MCX Options';
      return 'MCX Commodity';
    }
    return segment || 'Unknown';
  };

  const formatInstruments = (instruments) => {
    if (!Array.isArray(instruments)) return [];
    return instruments.map((one) => ({
      _id: one._id,
      id: `${one.segment}-${one.securityId}-${one.expiry || "na"}`,
      tradingSymbol: one.display_name || one.tradingsymbol || one.symbol_name || "Unknown",
      name: one.display_name || one.tradingsymbol || one.symbol_name || "Unknown",
      exchange: getExchangeDisplayName(one.segment, one.instrumentType),
      segment: one.segment,
      instrumentType: one.instrumentType || null,
      securityId: String(one.securityId),
      expiry: one.expiry || null,
      lotSize: one.lotSize ?? one.lot_size ?? null,
      lot_size: one.lotSize ?? one.lot_size ?? null,
      // For Option Chain orders - clean base symbol
      underlying_symbol: one.underlying_symbol || null,
      symbol_name: one.symbol_name || null,
    }));
  };

  // Debounced Search Logic with AbortController
  useEffect(() => {
    // Clear results if search term is empty or too short
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    // Cancel any in-flight request
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setIsSearching(true);

    const handle = setTimeout(() => {
      (async () => {
        try {
          const raw = await searchApi.search(searchTerm.trim(), abortController.signal);

          // Only update state if this request wasn't aborted
          if (!abortController.signal.aborted) {
            setSearchResults(formatInstruments(raw));
            setIsSearching(false);
          }
        } catch (e) {
          // Ignore abort errors (they're expected)
          if (e.name === 'AbortError') {
            console.log('[Search] Request cancelled:', searchTerm.trim());
            return;
          }

          console.error("Search failed:", e);
          if (!abortController.signal.aborted) {
            setSearchResults([]);
            setIsSearching(false);
          }
        }
      })();
    }, 300); // Balanced debounce time

    return () => {
      clearTimeout(handle);
      abortController.abort();
    };
  }, [searchTerm, searchApi]);

  // Live Data Subscription Logic with Debounce
  useEffect(() => {
    // Don't subscribe if no results or still searching
    if (!searchResults || searchResults.length === 0 || isSearching) {
      return;
    }

    // Debounce subscription to avoid rapid fire on every keystroke
    const handle = setTimeout(() => {
      const subscribeSearchResults = async () => {
        // Unsubscribe from old results
        if (searchSubscriptionsRef.current.length > 0) {
          try {
            await unsubscribe(searchSubscriptionsRef.current, 'quote');
            searchSubscriptionsRef.current = [];
          } catch (e) { console.warn(e); }
        }

        const subs = searchResults.map(r => ({ segment: r.segment, securityId: r.securityId }));

        try {
          await subscribe(subs, 'quote');
          searchSubscriptionsRef.current = subs;
        } catch (e) { console.warn(e); }

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
          setSearchSnapshots(map || {});
        } catch (e) { console.warn(e); }
      };
      subscribeSearchResults();
    }, 500); // Wait 500ms after results arrive before subscribing

    return () => clearTimeout(handle);
  }, [searchResults, isSearching, subscribe, unsubscribe, apiBase, token]);

  useEffect(() => {
    return () => {
      if (searchSubscriptionsRef.current.length > 0) {
        unsubscribe(searchSubscriptionsRef.current, 'quote').catch(() => { });
      }
    };
  }, [unsubscribe]);

  const segmentStringToNumberMap = useMemo(() => ({ "IDX_I": 0, "NSE_EQ": 1, "NSE_FNO": 2, "NSE_CURRENCY": 3, "BSE_EQ": 4, "BSE_CURRENCY": 7, "MCX_COMM": 5, "NSE_INDEX": 0, "BSE_INDEX": 0, "BSE_FNO": 8 }), []);

  // Use a state for live prices to decouple from high-freq ticks
  const [livePrices, setLivePrices] = useState({});
  const searchResultsRef = useRef(searchResults);

  useEffect(() => { searchResultsRef.current = searchResults; }, [searchResults]);

  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 200; // 5 FPS is enough for search results

    const updateLoop = (timestamp) => {
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (!ticksRef.current || !searchResultsRef.current) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const ticksMap = ticksRef.current;
      const currentResults = searchResultsRef.current;
      const num = (v) => (v == null || v === "" ? null : Number(v));
      const newPrices = {};
      let hasUpdates = false;

      currentResults.forEach(stock => {
        const numericSegment = segmentStringToNumberMap[stock.segment];
        const tickKey = `${numericSegment}-${stock.securityId}`;
        const snapKey = String(stock.securityId);
        const snap = searchSnapshots[snapKey] || {};
        const tick = ticksMap.get(tickKey) || {};

        const combined = { ...snap, ...tick };

        // Just extract what we need for the list item
        const ltp = num(combined.ltp);
        const open = num(combined.open);
        const close = num(combined.close);
        let percentChange = num(combined.percentChange);

        if (percentChange == null && ltp != null) {
          if (close != null && close !== 0) percentChange = ((ltp - close) / close) * 100;
          else if (open != null && open !== 0) percentChange = ((ltp - open) / open) * 100;
        }

        newPrices[stock.id] = { ltp, percentChange };
        hasUpdates = true;
      });

      if (hasUpdates) {
        setLivePrices(newPrices);
        lastUpdate = timestamp;
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [searchSnapshots, segmentStringToNumberMap]);


  const num = (v) => (v == null || v === "" ? null : Number(v));

  // --- Add to Watchlist Logic ---
  const handleAddToWatchlist = async (stock) => {
    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    if (!stock || !stock._id) {
      console.error("Cannot add stock, ID is missing.");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/watchlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instrumentId: stock._id, broker_id_str: brokerId, customer_id_str: customerId }),
      });

      if (response.ok) {
        // Invalidate watchlist cache so it reloads fresh data
        sessionStorage.removeItem('watchlist_cache');
        sessionStorage.removeItem('watchlist_cache_time');

        // *** PRE-SUBSCRIBE: Start receiving data BEFORE user navigates to watchlist ***
        // This gives a head start so data is already flowing when they arrive
        try {
          const subItem = { segment: stock.segment, securityId: stock.securityId };
          subscribe([subItem], 'quote');
          console.log(`[SearchPage] Pre-subscribed ${stock.tradingSymbol} to quote feed`);
        } catch (subErr) {
          console.warn("[SearchPage] Pre-subscribe failed:", subErr);
          // Non-blocking - order will still work, just might have slight delay
        }

        // *** Show Success Popup ***
        showToast(`${stock.tradingSymbol} added to watchlist!`, "success");
      } else {
        const errorData = await response.json();
        // *** Show Error Popup ***
        showToast(`Failed: ${errorData.message}`, "error");
      }
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      showToast("Network error. Please try again.", "error");
    }
  };

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] flex flex-col relative p-4 pb-20">

      {/* *** Custom Animation Style *** */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-toast {
          animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* *** Notification Popup (Toast) *** */}
      {notification.show && (
        <div
          className={`fixed top-8 left-1/2 z-50 
            px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 
            w-[90%] md:w-auto md:min-w-[400px] max-w-lg
            animate-toast
            ${notification.type === 'success'
              ? 'bg-gradient-to-r from-green-800/90 to-green-600/90 text-white border border-green-500/30'
              : 'bg-gradient-to-r from-red-800/90 to-red-600/90 text-white border border-red-500/30'
            }`}
          style={{ backdropFilter: "blur(8px)" }}
        >
          {/* Icon Section */}
          <div className="flex-shrink-0">
            {notification.type === 'success' ? (
              <svg className="w-6 h-6 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            ) : (
              <svg className="w-6 h-6 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            )}
          </div>

          {/* Text Section - One Line Forced */}
          <span className="font-medium text-sm md:text-base whitespace-nowrap overflow-hidden text-ellipsis">
            {notification.message}
          </span>
        </div>
      )}

      <h2 className="text-lg md:text-xl font-semibold text-[var(--text-primary)]">Search Instruments</h2>
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      {/* Loading Indicator */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--text-primary)]"></div>
          <span className="ml-3 text-[var(--text-secondary)]">Searching...</span>
        </div>
      )}

      {/* Minimum character message */}
      {searchTerm.trim() && searchTerm.trim().length < 2 && !isSearching && (
        <p className="text-center text-[var(--text-secondary)] pt-8">
          Type at least 2 characters to search
        </p>
      )}

      <ul className="space-y-2 text-sm md:text-base p-2 flex-grow overflow-y-auto mt-4">
        {!isSearching && searchResults && searchResults.map(stock => {
          const priceData = livePrices[stock.id] || {};
          const ltp = priceData.ltp;
          const percentChange = priceData.percentChange;

          return (
            <WatchlistItem
              key={stock.id}
              name={stock.tradingSymbol}
              exchange={stock.exchange || "—"}
              ltp={ltp}
              percentChange={percentChange}
              onClick={() => handleAddToWatchlist(stock)}
            />
          );
        })}
        {searchResults && searchResults.length === 0 && (
          <p className="text-center text-[var(--text-secondary)] pt-4">No symbols matched your search.</p>
        )}
      </ul>
    </div>
  );
}

export default SearchPage;