// Watchlist.jsx (colors matched to Portfolio/Orders)
import React, { useEffect, useState, useRef } from "react";
import BottomWindow from "./BottomWindow/BottomWindow";
import SearchBar from "./SearchBar";

// ======== WatchlistItem (card colors only changed) ========
const WatchlistItem = ({
  name,
  exchange,
  price,
  netChange,
  percentChange,
  isPositive,
  volume,
  onClick,
}) => {
  const priceColor =
    isPositive === true
      ? "text-green-400"
      : isPositive === false
      ? "text-red-400"
      : "text-gray-400";
  const changeColor = priceColor;
  const formattedPrice =
    price == null ? "—" : `₹${Number(price).toFixed(2)}`;
  const formattedNetChange =
    netChange == null
      ? "—"
      : `${netChange > 0 ? "+" : ""}${Number(netChange).toFixed(2)}`;
  const formattedPercentChange =
    percentChange == null
      ? "—"
      : `(${percentChange > 0 ? "+" : ""}${percentChange.toFixed(2)}%)`;
  const formattedVolume = volume
    ? `${(Number(volume) / 100000).toFixed(2)}L`
    : "—";

  return (
    <li
      onClick={onClick}
      className="bg-[#121a2b] border border-white/10 p-3 rounded-lg hover:bg-[#172238] transition duration-150 cursor-pointer"
    >
      <div className="flex justify-between items-center w-full">
        <div>
          <span className="font-medium text-white/90 block">{name}</span>
          <span className="text-xs text-gray-400 block mt-0.5">
            {exchange}
          </span>
        </div>
        <div className="text-right">
          <span className={`font-semibold text-lg block ${priceColor}`}>
            {formattedPrice}
          </span>
          <span className={`text-xs block ${changeColor}`}>
            {formattedNetChange} {formattedPercentChange}
          </span>
          <span className="text-xs text-gray-400 block">
            Vol: {formattedVolume}
          </span>
        </div>
      </div>
    </li>
  );
};

// ======== IndexCard (match card palette) ========
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
          <p className={`${changeColor} text-sm`}>
            {arrow} {change}%
          </p>
        </div>
      </div>
    </div>
  );
};

// ======== Main ========
function Watchlist() {
  const [stocks, setStocks] = useState([]);
  const [prices, setPrices] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [actionTab, setActionTab] = useState("Buy");
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState("");
  const pollingRef = useRef(null);
  const POLL_INTERVAL = 5000;

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchStockList = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/instrumentGetName`
        );
        const data = await res.json();
        if (data.names && Array.isArray(data.names)) {
          const dynamicList = data.names.map((name) => ({
            id: name.replace(/\s+/g, "_").toUpperCase(),
            name,
            tradingSymbol: name.split(" ")[0].toUpperCase(),
            exchange: "NSE_FO",
          }));
          setStocks(dynamicList);
        } else {
          console.warn("No instruments received:", data);
        }
      } catch (err) {
        console.error("Error loading instruments list:", err);
      }
    };

    fetchStockList();
  }, []);

  const fetchWatchlistQuotes = async () => {
    try {
      if (!stocks.length) return;
      const symbolsForApi = stocks.map((s) => s.name);
      const res = await fetch(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/watchlist-quotes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: symbolsForApi }),
        }
      );
      const result = await res.json();

      const upstoxWrapper = result?.data ?? result;
      const upstoxData = upstoxWrapper?.data ?? upstoxWrapper;

      if (!upstoxData || typeof upstoxData !== "object") {
        console.warn("⚠️ Invalid API response:", result);
        return;
      }

      const newPrices = {};
      stocks.forEach((stock) => {
        const matchingKey = Object.keys(upstoxData).find((k) =>
          k.toUpperCase().includes(stock.tradingSymbol.toUpperCase())
        );
        const quote = matchingKey ? upstoxData[matchingKey] : null;
        const exchange = matchingKey
          ? matchingKey.split("|")[0]
          : stock.exchange;

        if (quote && (quote.last_price != null || quote.ltp != null)) {
          const ltp = quote.last_price ?? quote.ltp;
          const open = quote.ohlc?.open ?? ltp;
          const netChange = ltp - open;
          const percentChange = open !== 0 ? (netChange / open) * 100 : 0;

          newPrices[stock.id] = {
            ltp,
            netChange,
            percentChange,
            isPositive: netChange >= 0,
            volume: quote.volume ?? null,
            dayHigh: quote.ohlc?.high ?? null,
            dayLow: quote.ohlc?.low ?? null,
            exchange,
            sourceKey: matchingKey || "",
            bestBidPrice: quote.depth?.buy?.[0]?.price ?? null,
            bestBidQuantity: quote.depth?.buy?.[0]?.quantity ?? null,
            bestAskPrice: quote.depth?.sell?.[0]?.price ?? null,
            bestAskQuantity: quote.depth?.sell?.[0]?.quantity ?? null,
            depth: quote.depth ?? null,
          };
        } else {
          newPrices[stock.id] = {
            ltp: null,
            netChange: null,
            percentChange: null,
            isPositive: null,
            volume: null,
            dayHigh: null,
            dayLow: null,
            exchange: stock.exchange,
            sourceKey: "",
          };
        }
      });

      setPrices((prev) => ({ ...prev, ...newPrices }));
    } catch (err) {
      console.error("fetchWatchlistQuotes error:", err);
    }
  };

  useEffect(() => {
    fetchWatchlistQuotes();
    pollingRef.current = setInterval(fetchWatchlistQuotes, POLL_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks]);

  useEffect(() => {
    if (!selectedStock) return;
    const p = prices[selectedStock.id];
    setOrderPrice(p?.ltp != null ? Number(p.ltp).toFixed(2) : "");
    setQuantity(1);
  }, [selectedStock, prices]);

  const sheetData = selectedStock ? prices[selectedStock.id] || {} : {};

  const filteredStocks = stocks.filter((stock) => {
    const symbol = stock.tradingSymbol || stock.name || "";
    return symbol.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-full h-full bg-[#0b1020] md:w-1/2 lg:w-3/12 md:border-r border-white/10 flex flex-col relative">
      {/* Header + Search (match bg) */}
      <div className="p-4 text-white/90 border-b border-white/10 sticky top-0 bg-[#0b1020] z-20 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">Watchlist</h2>
        </div>

        {SearchBar ? (
          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        ) : (
          <input
            className="mt-2 p-2 rounded-md bg-[#121a2b] border border-white/10 text-white placeholder:text-gray-400"
            placeholder="Search symbol (e.g., ASTRAL)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        )}
      </div>

      {/* Index cards (same palette) */}
      <div className="p-2 flex sticky top-[120px] bg-[#0b1020] z-10 border-b border-white/10">
        <IndexCard name="Sensex" price="65,123.45" change="0.85" isPositive />
        <IndexCard
          name="Nifty 50"
          price="19,380.20"
          change="0.42"
          isPositive={false}
        />
      </div>

      {/* List */}
      <ul className="space-y-2 text-sm md:text-base p-2 flex-grow overflow-y-auto">
        {filteredStocks.map((stock) => {
          const priceData = prices[stock.id] || {};
          const exchange = priceData.exchange || "NSE FO";
          return (
            <WatchlistItem
              key={stock.id}
              name={stock.tradingSymbol}
              exchange={exchange}
              price={priceData.ltp}
              netChange={priceData.netChange}
              percentChange={priceData.percentChange}
              isPositive={priceData.isPositive}
              volume={priceData.volume}
              onClick={() => {
                setSelectedStock(stock);
                setActionTab("Buy");
              }}
            />
          );
        })}

        {filteredStocks.length === 0 && searchTerm && (
          <p className="text-center text-gray-500 pt-4">
            No symbols found matching "{searchTerm}"
          </p>
        )}
      </ul>

      {/* Bottom Sheet (unchanged) */}
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
      />
    </div>
  );
}

export default Watchlist;
