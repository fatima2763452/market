// hooks/useOptionChain.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';

const apiBase = import.meta.env.VITE_REACT_APP_API_URL || 'https://api.wolfkrypt.me';

/**
 * Custom hook to fetch and manage option chain data with live updates
 * @param {Object} params - { segment, securityId, expiry }
 * @returns {Object} - { chainData, loading, error, spotPrice, expiries, refetch }
 */
export function useOptionChain({ segment, securityId, expiry }) {
  const [chainData, setChainData] = useState(null);
  const [spotPrice, setSpotPrice] = useState(null);
  const [expiries, setExpiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { ticks, subscribe, unsubscribe, isConnected } = useMarketData();
  
  // Track subscribed option instruments to avoid duplicate subscriptions
  const subscribedInstrumentsRef = useRef(new Set());
  const lastFetchParamsRef = useRef(null);

  /**
   * Fetch option chain data from backend
   */
  const fetchOptionChain = useCallback(async () => {
    if (!segment || !securityId) {
      console.warn('[useOptionChain] Missing required params:', { segment, securityId });
      return;
    }

    const symbol = `${segment}|${securityId}`;
    const params = new URLSearchParams({ symbol });
    if (expiry) params.append('expiry', expiry);

    const paramsKey = `${segment}|${securityId}|${expiry || 'default'}`;
    
    // Avoid duplicate fetches
    if (lastFetchParamsRef.current === paramsKey) {
      console.log('[useOptionChain] Skipping duplicate fetch');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[useOptionChain] Fetching option chain:', { symbol, expiry });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/api/option-chain?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'Failed to fetch option chain');
      }

      const result = await response.json();
      console.log('[useOptionChain] Received data:', {
        totalStrikes: result.data?.chain?.length,
        spotPrice: result.data?.spotPrice,
        expiry: result.data?.expiry
      });

      setChainData(result.data.chain);
      setSpotPrice(result.data.spotPrice);
      
      lastFetchParamsRef.current = paramsKey;
      return result.data;

    } catch (err) {
      console.error('[useOptionChain] Fetch error:', err);
      setError(err.message);
      setChainData(null);
    } finally {
      setLoading(false);
    }
  }, [segment, securityId, expiry]);

  /**
   * Fetch available expiry dates for the underlying
   */
  const fetchExpiries = useCallback(async () => {
    if (!segment || !securityId) return;

    const symbol = `${segment}|${securityId}`;
    const params = new URLSearchParams({ symbol });

    console.log('[useOptionChain] Fetching expiries for:', symbol);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/api/option-chain/expiries?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('[useOptionChain] Failed to fetch expiries');
        return;
      }

      const result = await response.json();
      console.log('[useOptionChain] Expiries received:', result.data?.expiries);
      setExpiries(result.data?.expiries || []);

    } catch (err) {
      console.warn('[useOptionChain] Expiries fetch error:', err);
    }
  }, [segment, securityId]);

  /**
   * Subscribe to live data for all option strikes in the chain
   */
  const subscribeToOptionStrikes = useCallback(async (chainArray) => {
    if (!chainArray || chainArray.length === 0 || !isConnected) {
      console.warn('[useOptionChain] Cannot subscribe - no chain data or socket disconnected');
      return;
    }

    console.log('[useOptionChain] Subscribing to', chainArray.length, 'strikes');

    // Build subscription list for all call and put options
    const subscriptionList = [];
    const subscriptionKeys = new Set();

    chainArray.forEach(row => {
      // For now, we subscribe to the underlying's full packet which includes all options
      // This is a simplified approach - ideally backend would provide option securityIds
      
      // Add call option if exists
      if (row.call) {
        const key = `${segment}-call-${row.strike}`;
        if (!subscribedInstrumentsRef.current.has(key)) {
          subscriptionKeys.add(key);
        }
      }

      // Add put option if exists
      if (row.put) {
        const key = `${segment}-put-${row.strike}`;
        if (!subscribedInstrumentsRef.current.has(key)) {
          subscriptionKeys.add(key);
        }
      }
    });

    if (subscriptionKeys.size === 0) {
      console.log('[useOptionChain] All strikes already subscribed');
      return;
    }

    // For now, we'll rely on the underlying's full subscription
    // In a production setup, you'd subscribe to individual option instruments
    console.log('[useOptionChain] Option strikes tracked:', subscriptionKeys.size);
    
    // Mark as subscribed
    subscriptionKeys.forEach(key => subscribedInstrumentsRef.current.add(key));

  }, [segment, isConnected]);

  /**
   * Unsubscribe from option strikes
   */
  const unsubscribeFromOptionStrikes = useCallback(async () => {
    if (subscribedInstrumentsRef.current.size === 0) return;

    console.log('[useOptionChain] Unsubscribing from option strikes');
    
    // Clear subscription tracking
    subscribedInstrumentsRef.current.clear();
    lastFetchParamsRef.current = null;

  }, []);

  /**
   * Update chain data with live ticks
   * This merges WebSocket updates into the chain data
   */
  useEffect(() => {
    if (!chainData || chainData.length === 0 || ticks.size === 0) return;

    // Create a map for quick lookup
    const segmentToNumberMap = {
      'IDX_I': 0,
      'NSE_EQ': 1,
      'NSE_FNO': 2,
      'NSE_CURRENCY': 3,
      'BSE_EQ': 4,
      'BSE_CURRENCY': 5,
      'MCX_COMM': 5,
      'NSE_INDEX': 0,
    };

    const numericSegment = segmentToNumberMap[segment] ?? 0;

    // Check if any relevant ticks exist
    let hasUpdates = false;
    const updatedChain = chainData.map(row => {
      // For simplicity, we'll update based on matching data from ticks
      // In production, you'd match by option securityId
      
      // This is a placeholder - actual implementation would need option-specific securityIds
      return row;
    });

    if (hasUpdates) {
      setChainData(updatedChain);
    }

  }, [ticks, chainData, segment]);

  /**
   * Initial fetch when params change
   */
  useEffect(() => {
    if (!segment || !securityId || !isConnected) return;

    fetchOptionChain().then(data => {
      if (data?.chain) {
        subscribeToOptionStrikes(data.chain);
      }
    });

    fetchExpiries();

    // Cleanup on unmount or param change
    return () => {
      unsubscribeFromOptionStrikes();
    };
  }, [segment, securityId, expiry, isConnected, fetchOptionChain, fetchExpiries, subscribeToOptionStrikes, unsubscribeFromOptionStrikes]);

  return {
    chainData,
    spotPrice,
    expiries,
    loading,
    error,
    refetch: fetchOptionChain,
  };
}
