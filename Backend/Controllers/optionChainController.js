import { getDhanOptionChain, getDhanExpiryList, getNearestExpiry } from '../services/dhanOptionChain.js';
import Instrument from '../Model/InstrumentModel.js';

/**
 * Get option chain data from Dhan API
 * Query params:
 *   - symbol: Either tradingSymbol or "segment|securityId" format
 *   - expiry: Expiry date in YYYY-MM-DD format (optional, defaults to nearest)
 */
async function getOptionChain(req, res) {
    try {
        const { symbol, expiry } = req.query;

        // Validate required parameters
        if (!symbol) {
            return res.status(400).json({
                error: 'Missing required parameter',
                details: 'symbol is required'
            });
        }

        // console.log('[OptionChainController] Request received:', { symbol, expiry });

        // Parse symbol to get securityId, segment, and underlying info
        let underlyingScrip, underlyingSeg, underlyingSymbol;

        if (symbol.includes('|')) {
            // Format: "NSE_FNO|58071"
            const [segment, securityId] = symbol.split('|');
            underlyingSeg = segment;

            const instrument = await Instrument.findOne({
                securityId: String(securityId),
                segment: segment
            }).lean();

            if (!instrument) {
                console.error('[OptionChainController] Instrument not found for securityId:', securityId);
                return res.status(404).json({
                    error: 'Instrument not found',
                    details: `No instrument found with securityId: ${securityId} and segment: ${segment}`
                });
            }

            underlyingScrip = instrument.securityId;
            underlyingSymbol = instrument.underlying_symbol || instrument.symbol_name;

            console.log('[OptionChainController] Found instrument:', {
                underlyingScrip,
                underlyingSeg,
                underlyingSymbol
            });
        } else {
            // Look up by trading symbol or underlying symbol
            // console.log('[OptionChainController] Looking up instrument by symbol:', symbol);

            const instrument = await Instrument.findOne({
                $or: [
                    { tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') } },
                    { underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') } },
                    { symbol_name: { $regex: new RegExp(`^${symbol}$`, 'i') } }
                ]
            }).lean();

            if (!instrument) {
                console.error('[OptionChainController] Instrument not found:', symbol);
                return res.status(404).json({
                    error: 'Instrument not found',
                    details: `No instrument found with symbol: ${symbol}`
                });
            }

            underlyingScrip = instrument.securityId;
            underlyingSeg = instrument.segment;
            underlyingSymbol = instrument.underlying_symbol || instrument.symbol_name;

            // console.log('[OptionChainController] Found instrument:', {
            //     underlyingScrip,
            //     underlyingSeg,
            //     underlyingSymbol
            // });
        }

        // Map segment to Dhan format (IDX_I for indices, keep others as-is)
        if (underlyingSeg === 'NSE_INDEX') {
            underlyingSeg = 'IDX_I';
        }

        // If no expiry provided, fetch expiry list and use nearest
        let targetExpiry = expiry;
        if (!targetExpiry) {
            // console.log('[OptionChainController] No expiry provided, fetching expiry list');
            
            const expiries = await getDhanExpiryList({
                underlyingScrip,
                underlyingSeg
            });

            targetExpiry = getNearestExpiry(expiries);

            if (!targetExpiry) {
                return res.status(404).json({
                    error: 'No active expiries found',
                    details: 'Could not find any future expiry dates for this instrument'
                });
            }

            // console.log('[OptionChainController] Using nearest expiry:', targetExpiry);
        }

        // Fetch option chain from Dhan
        const optionChainData = await getDhanOptionChain({
            underlyingScrip,
            underlyingSeg,
            expiry: targetExpiry
        });

        console.log('[OptionChainController] Successfully fetched option chain with', 
                    optionChainData.totalStrikes, 'strikes');

        // Return formatted data
        return res.json({
            ok: true,
            data: {
                underlying: underlyingSymbol,
                underlyingScrip,
                underlyingSeg,
                expiry: targetExpiry,
                spotPrice: optionChainData.underlyingLtp,
                chain: optionChainData.chain,
                meta: {
                    totalStrikes: optionChainData.totalStrikes,
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('[OptionChainController] Error:', error);

        // Return user-friendly error
        return res.status(500).json({
            error: 'Failed to fetch option chain',
            details: error.message,
            hint: 'Please check if the instrument supports options and has active expiries'
        });
    }
}

/**
 * Get list of available expiry dates for an underlying
 * Query params:
 *   - symbol: Either tradingSymbol or "segment|securityId" format
 */
async function getExpiryList(req, res) {
    try {
        const { symbol } = req.query;

        if (!symbol) {
            return res.status(400).json({
                error: 'Missing required parameter',
                details: 'symbol is required'
            });
        }

        console.log('[ExpiryListController] Request received:', { symbol });

        // Parse symbol (same logic as getOptionChain)
        let underlyingScrip, underlyingSeg;

        if (symbol.includes('|')) {
            const [segment, securityId] = symbol.split('|');
            underlyingSeg = segment;

            const instrument = await Instrument.findOne({
                securityId: String(securityId),
                segment: segment
            }).lean();

            if (!instrument) {
                return res.status(404).json({
                    error: 'Instrument not found'
                });
            }

            underlyingScrip = instrument.securityId;
        } else {
            const instrument = await Instrument.findOne({
                $or: [
                    { tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') } },
                    { underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') } }
                ]
            }).lean();

            if (!instrument) {
                return res.status(404).json({
                    error: 'Instrument not found'
                });
            }

            underlyingScrip = instrument.securityId;
            underlyingSeg = instrument.segment;
        }

        // Map segment
        if (underlyingSeg === 'NSE_INDEX') {
            underlyingSeg = 'IDX_I';
        }

        // Fetch expiry list
        const expiries = await getDhanExpiryList({
            underlyingScrip,
            underlyingSeg
        });

        const nearestExpiry = getNearestExpiry(expiries);

        console.log('[ExpiryListController] Found', expiries.length, 'expiries');

        return res.json({
            ok: true,
            data: {
                expiries,
                nearest: nearestExpiry,
                count: expiries.length
            }
        });

    } catch (error) {
        console.error('[ExpiryListController] Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch expiry list',
            details: error.message
        });
    }
}

export { getOptionChain, getExpiryList };
