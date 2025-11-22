import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import SearchBar from "../WatchList/SearchBar";
import BottomWindow from "../WatchList/BottomWindow/BottomWindow";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";

// List item with LTP and percent change (like watchlist)
const WatchlistItem = ({ name, exchange, onClick, ltp, percentChange }) => {
  const priceColor = percentChange == null ? "text-gray-400" : percentChange >= 0 ? "text-green-400" : "text-red-400";
  const formattedLtp = ltp != null ? `₹${ltp.toFixed(2)}` : "—";
  const formattedPercent = percentChange != null ? `${percentChange >= 0 ? "▲" : "▼"} ${Math.abs(percentChange).toFixed(2)}%` : "—";

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
          <span className={`block text-sm font-semibold ${priceColor}`}>{formattedLtp}</span>
          <span className={`block text-xs ${priceColor}`}>{formattedPercent}</span>
        </div>
      </div>
    </li>
  );
};

function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sheetData, setSheetData] = useState({});
  const [snapshots, setSnapshots] = useState({}); // snapshots for selected stock only
  const [searchSnapshots, setSearchSnapshots] = useState({}); // snapshots for search results list

  // Track currently subscribed instrument for cleanup
  const currentSubscriptionRef = useRef(null);
  // Track search results subscriptions for cleanup
  const searchSubscriptionsRef = useRef([]);

  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) ||
    null;

  // Use shared socket connection from context
  const { ticks, subscribe, unsubscribe } = useMarketData();
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "https://api.wolfkrypt.me";

  const searchApi = useMemo(
    () => ({
      search: async (q) => {
        const url = `${apiBase}/api/instruments/search?q=${encodeURIComponent(
          q
        )}`;
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`search failed: ${q} status:${r.status} ${text}`);
        }
        const data = await r.json();
        return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
      },
    }),
    [apiBase]
  );

  const formatInstruments = (instruments) => {
    if (!Array.isArray(instruments)) return [];
    return instruments.map((one) => ({
      _id: one._id,
      id: `${one.segment}-${one.securityId}-${one.expiry || "na"}`,
      tradingSymbol:
        one.display_name || one.tradingsymbol || one.symbol_name || "Unknown",
      exchange: one.segment === "MCX_COMM" ? "MCX" : "NSE",
      segment: one.segment,
      securityId: String(one.securityId),
      expiry: one.expiry || null,
      lotSize: one.lotSize ?? null,
    }));
  };

  // Debounced search; results remain lightweight (no live data)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(() => {
      (async () => {
        try {
          const raw = await searchApi.search(searchTerm.trim());
          setSearchResults(formatInstruments(raw));
        } catch (e) {
          console.error("Search failed:", e);
          setSearchResults([]);
        }
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm, searchApi]);

  // Subscribe search results to 'quote' packet for live LTP and %change
  useEffect(() => {
    const subscribeSearchResults = async () => {
      // Cleanup previous search subscriptions
      if (searchSubscriptionsRef.current.length > 0) {
        try {
          // Removed spamming log: Unsubscribing previous search results
          await unsubscribe(searchSubscriptionsRef.current, 'quote');
          searchSubscriptionsRef.current = [];
        } catch (e) {
          console.warn("[SearchPage] Failed to unsubscribe previous search results:", e?.message || e);
        }
      }

      if (!searchResults || searchResults.length === 0) {
        setSearchSnapshots({});
        return;
      }

      const subs = searchResults.map(r => ({
        segment: r.segment,
        securityId: r.securityId
      }));

      // Subscribe to 'quote' packet for lightweight live data
      try {
        // Removed spamming log: Subscribing search results to 'quote'
        await subscribe(subs, 'quote');
        searchSubscriptionsRef.current = subs;
      } catch (e) {
        console.warn("[SearchPage] Failed to subscribe search results:", e?.message || e);
      }

      // Fetch initial snapshots
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
      } catch (e) {
        console.warn("[SearchPage] search snapshots fetch failed:", e?.message || e);
      }
    };

    subscribeSearchResults();
  }, [searchResults, subscribe, unsubscribe, apiBase, token]);

  const subscribeAndSnapshot = useCallback(
    async (instrumentList, subscriptionType = "full") => {
      if (!instrumentList || instrumentList.length === 0) return;

      // Unsubscribe previous instrument first (SearchPage: only 1 active at a time)
      if (currentSubscriptionRef.current) {
        try {
          // Removed spamming log: Unsubscribing previous
          await unsubscribe([currentSubscriptionRef.current], 'full');
        } catch (e) {
          console.warn("[SearchPage] unsubscribe failed:", e?.message || e);
        }
      }

      const subs = instrumentList.map((p) => ({
        segment: p.segment,
        securityId: p.securityId,
      }));

      // Subscribe to new instrument with specified type
      try {
        // Removed spamming log: Subscribing to subscriptionType
        await subscribe(subs, subscriptionType);
        // Track current subscription for cleanup
        currentSubscriptionRef.current = subs[0];
      } catch (e) {
        console.warn("[SearchPage] subscribe failed:", e?.message || e);
      }

      // Fetch snapshot
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
        setSnapshots((prev) => ({ ...prev, ...map }));
      } catch (e) {
        console.warn("[SearchPage] snapshot fetch failed:", e?.message || e);
      }
    },
    [subscribe, unsubscribe, apiBase, token]
  );

  useEffect(() => {
    if (selectedStock) {
      // Subscribe to 'full' packet for complete detail view (market depth, OI, etc.)
      subscribeAndSnapshot([selectedStock], 'full');
    } else {
      // User closed BottomWindow - unsubscribe and clear data
      if (currentSubscriptionRef.current) {
        (async () => {
          try {
            // Removed spamming log: User closed details, unsubscribing
            await unsubscribe([currentSubscriptionRef.current], 'full');
            currentSubscriptionRef.current = null;
          } catch (e) {
            console.warn("[SearchPage] cleanup unsubscribe failed:", e?.message || e);
          }
        })();
      }
      // Clear sheet data when no selection
      setSheetData({});
    }
  }, [selectedStock, subscribeAndSnapshot, unsubscribe]);

  // Cleanup on unmount: unsubscribe any active subscription
  useEffect(() => {
    return () => {
      if (currentSubscriptionRef.current) {
        // Removed spamming log: Component unmounting, cleaning up detail subscription
        unsubscribe([currentSubscriptionRef.current], 'full').catch(e =>
          console.warn("[SearchPage] unmount cleanup failed:", e?.message || e)
        );
      }
      if (searchSubscriptionsRef.current.length > 0) {
        // Removed spamming log: Component unmounting, cleaning up search subscriptions
        unsubscribe(searchSubscriptionsRef.current, 'quote').catch(e =>
          console.warn("[SearchPage] search unmount cleanup failed:", e?.message || e)
        );
      }
    };
  }, [unsubscribe]);

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

  const num = (v) => (v == null || v === "" ? null : Number(v));

  useEffect(() => {
    if (!selectedStock) return;
    const numericSegment = segmentStringToNumberMap[selectedStock.segment];
    const tickKey = `${numericSegment}-${selectedStock.securityId}`;
    const snapKey = String(selectedStock.securityId);
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
      if (percentChange != null) netChange = ltp * (percentChange / 100);
      else if (close != null) netChange = ltp - close;
      else if (open != null) netChange = ltp - open;
    }
    setSheetData({
      ltp,
      netChange,
      percentChange,
      isPositive:
        netChange != null
          ? netChange >= 0
          : percentChange != null
          ? percentChange >= 0
          : null,
      open,
      high,
      low,
      close,
      volume,
      oi,
      bestBidPrice: num(combined.bestBidPrice),
      bestBidQuantity: num(combined.bestBidQuantity),
      bestAskPrice: num(combined.bestAskPrice),
      bestAskQuantity: num(combined.bestAskQuantity),
      lastTradeQty: num(combined.lastTradeQty),
      lastTradeTime: combined.lastTradeTime,
      depth: combined.depth,
    });
  }, [selectedStock, ticks, snapshots, segmentStringToNumberMap]);

  const handleAddToWatchlist = async (stock) => {
    if (!stock || !stock._id) {
      alert("Cannot add stock, ID is missing.");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/watchlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ instrumentId: stock._id }),
      });
      if (response.ok) {
        alert(`${stock.tradingSymbol} added to watchlist!`);
      } else {
        const errorData = await response.json();
        alert(`Failed to add to watchlist: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      alert("An error occurred while adding to the watchlist.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0b1020] flex flex-col relative p-4 pb-20">
      <h2 className="text-lg md:text-xl font-semibold text-white">Search Instruments</h2>
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <ul className="space-y-2 text-sm md:text-base p-2 flex-grow overflow-y-auto mt-4">
        {searchResults && searchResults.map(stock => {
          // Get live data from searchSnapshots and ticks
          const numericSegment = segmentStringToNumberMap[stock.segment];
          const tickKey = `${numericSegment}-${stock.securityId}`;
          const snapKey = String(stock.securityId);

          const snap = searchSnapshots[snapKey] || {};
          const tick = ticks.get(tickKey) || {};
          const combined = { ...snap, ...tick };

          const ltp = num(combined.ltp);
          const open = num(combined.open);
          const close = num(combined.close);

          let percentChange = num(combined.percentChange);
          if (percentChange == null && ltp != null) {
            if (close != null && close !== 0) {
              percentChange = ((ltp - close) / close) * 100;
            } else if (open != null && open !== 0) {
              percentChange = ((ltp - open) / open) * 100;
            }
          }

          return (
            <WatchlistItem
              key={stock.id}
              name={stock.tradingSymbol}
              exchange={stock.exchange || "—"}
              ltp={ltp}
              percentChange={percentChange}
              onClick={() => setSelectedStock(stock)}
            />
          );
        })}
        {searchResults && searchResults.length === 0 && (
          <p className="text-center text-gray-500 pt-4">No symbols matched your search.</p>
        )}
      </ul>
      {selectedStock && (
        <BottomWindow
          selectedStock={selectedStock}
          sheetData={sheetData}
          setSelectedStock={setSelectedStock}
          onAddToWatchlist={handleAddToWatchlist}
          actionTab={"Buy"}
          setActionTab={() => {}}
          quantity={1}
          setQuantity={() => {}}
          orderPrice={""}
          setOrderPrice={() => {}}
          subscriptionType="full"
        />
      )}
    </div>
  );
}

export default SearchPage;
