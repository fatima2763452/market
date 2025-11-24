import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StockChart from './StockChart.jsx';

function ChartPage() {
  const { segment, securityId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instrumentName, setInstrumentName] = useState('');
  const [loading, setLoading] = useState(true);

  // Reconstruct symbol from URL params
  const symbol = `${segment}|${securityId}`;
  
  // Fetch instrument details to get display name
  useEffect(() => {
    const fetchInstrumentName = async () => {
      try {
        const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';
        const url = `${baseUrl}/api/instruments/lookup?securityId=${securityId}&segment=${segment}`;
        
        console.log('[ChartPage] Fetching instrument from:', url);
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[ChartPage] Instrument data received:', data);
          
          // Priority: display_name > symbol_name > tradingsymbol
          const name = data.display_name || data.symbol_name || data.tradingsymbol || `${segment} ${securityId}`;
          setInstrumentName(name);
        } else {
          const errorText = await response.text();
          console.error('[ChartPage] API error:', response.status, errorText);
          setInstrumentName(`${segment} ${securityId}`);
        }
      } catch (error) {
        console.error('[ChartPage] Failed to fetch instrument name:', error);
        setInstrumentName(`${segment} ${securityId}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInstrumentName();
  }, [segment, securityId]);
  
  // Get URL parameters for chart state (read-only, no updates to prevent infinite loop)
  const urlInterval = searchParams.get('interval');
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');

  return (
    <div className="min-h-screen bg-[#0E1324] p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 bg-[#1A1F30] rounded-lg p-4 shadow-lg">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0E1324] text-gray-300 rounded-lg hover:bg-white/5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {loading ? 'Loading...' : (instrumentName || `${segment} ${securityId}`)}
            </h1>
            <p className="text-sm text-gray-400">
              {segment}
            </p>
          </div>
        </div>

        {/* Full-Screen Chart with initial URL state */}
        <StockChart 
          symbol={symbol} 
          tradingSymbol={null}
          initialInterval={urlInterval}
          initialFrom={urlFrom}
          initialTo={urlTo}
        />
      </div>
    </div>
  );
}

export default ChartPage;
