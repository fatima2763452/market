// contexts/MarketDataContext.jsx
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { useMarketTicks } from '../hooks/useMarketTicks';

const MarketDataContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const MarketDataProvider = ({ children }) => {
  const [token] = React.useState(() => 
    (typeof window !== "undefined" && localStorage.getItem("token")) || null
  );
  
  const socketOpts = React.useMemo(() => ({
    auth: token ? { token } : undefined,
    withCredentials: true,
  }), [token]);

  // Single shared socket connection for the entire app
  const marketData = useMarketTicks("/market", socketOpts);

  return (
    <MarketDataContext.Provider value={marketData}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within MarketDataProvider');
  }
  return context;
};

