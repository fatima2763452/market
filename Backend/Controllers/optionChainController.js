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

        // Batch lookup securityIds for all CE/PE contracts
        // This enables WebSocket subscription for live data
        const chainWithSecurityIds = await enrichChainWithSecurityIds(
            optionChainData.chain,
            underlyingSymbol,
            targetExpiry
        );

        // Return formatted data
        return res.json({
            ok: true,
            data: {
                underlying: underlyingSymbol,
                underlyingScrip,
                underlyingSeg,
                expiry: targetExpiry,
                spotPrice: optionChainData.underlyingLtp,
                chain: chainWithSecurityIds,
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

/**
 * Lookup the security_Id for an option contract from instruments collection
 * Query params:
 *   - underlying_symbol: e.g., "NIFTY", "HDFCBANK"
 *   - strike: Strike price (number)
 *   - optionType: "CE" or "PE"
 *   - expiry: Expiry date in YYYY-MM-DD format
 */
async function getOptionSecurityId(req, res) {
    try {
        const { underlying_symbol, strike, optionType, expiry } = req.query;

        if (!underlying_symbol || !strike || !optionType || !expiry) {
            return res.status(400).json({
                error: 'Missing required parameters',
                details: 'underlying_symbol, strike, optionType, and expiry are required'
            });
        }

        console.log('[getOptionSecurityId] Looking up:', { underlying_symbol, strike, optionType, expiry });

        // Parse expiry date for range query (to handle timezone differences)
        const expiryDate = new Date(expiry);
        const expiryStart = new Date(expiryDate);
        expiryStart.setHours(0, 0, 0, 0);
        const expiryEnd = new Date(expiryDate);
        expiryEnd.setHours(23, 59, 59, 999);

        // Find the option contract in instruments collection
        const instrument = await Instrument.findOne({
            underlying_symbol: { $regex: new RegExp(`^${underlying_symbol}$`, 'i') },
            strike: Number(strike),
            optionType: optionType.toUpperCase(),
            expiry: { $gte: expiryStart, $lte: expiryEnd },
            segment: 'NSE_FNO'
        }).lean();

        if (!instrument) {
            console.log('[getOptionSecurityId] No instrument found for:', { underlying_symbol, strike, optionType, expiry });
            return res.status(404).json({
                error: 'Option contract not found',
                details: `No option found for ${underlying_symbol} ${strike} ${optionType} expiring ${expiry}`
            });
        }

        console.log('[getOptionSecurityId] Found instrument:', {
            securityId: instrument.securityId,
            tradingsymbol: instrument.tradingsymbol,
            lotSize: instrument.lotSize
        });

        return res.json({
            ok: true,
            data: {
                securityId: instrument.securityId,
                tradingsymbol: instrument.tradingsymbol,
                segment: instrument.segment,
                lotSize: instrument.lotSize,
                tickSize: instrument.tickSize
            }
        });

    } catch (error) {
        console.error('[getOptionSecurityId] Error:', error);
        return res.status(500).json({
            error: 'Failed to lookup option security ID',
            details: error.message
        });
    }
}

/**
 * Enrich option chain data with securityIds for WebSocket subscription
 * Performs batch lookup for all CE/PE contracts in the chain
 */
async function enrichChainWithSecurityIds(chain, underlyingSymbol, expiry) {
    if (!chain || chain.length === 0) {
        return chain;
    }

    try {
        // Parse expiry date for range query
        const expiryDate = new Date(expiry);
        const expiryStart = new Date(expiryDate);
        expiryStart.setHours(0, 0, 0, 0);
        const expiryEnd = new Date(expiryDate);
        expiryEnd.setHours(23, 59, 59, 999);

        // Extract all strikes from the chain
        const strikes = chain.map(row => Number(row.strike));

        // Batch query all option contracts for this underlying and expiry
        const instruments = await Instrument.find({
            underlying_symbol: { $regex: new RegExp(`^${underlyingSymbol}$`, 'i') },
            strike: { $in: strikes },
            expiry: { $gte: expiryStart, $lte: expiryEnd },
            segment: 'NSE_FNO',
            optionType: { $in: ['CE', 'PE'] }
        }).lean();

        // Create lookup map: "strike|optionType" -> instrument data
        const instrumentMap = new Map();
        for (const inst of instruments) {
            const key = `${inst.strike}|${inst.optionType}`;
            instrumentMap.set(key, {
                securityId: inst.securityId,
                tradingsymbol: inst.tradingsymbol,
                lotSize: inst.lotSize,
                tickSize: inst.tickSize
            });
        }

        console.log(`[enrichChainWithSecurityIds] Found ${instruments.length} instruments for ${chain.length} strikes`);

        // Enrich chain with security IDs
        const enrichedChain = chain.map(row => {
            const ceKey = `${row.strike}|CE`;
            const peKey = `${row.strike}|PE`;
            const ceInstrument = instrumentMap.get(ceKey);
            const peInstrument = instrumentMap.get(peKey);

            return {
                ...row,
                call: row.call ? {
                    ...row.call,
                    securityId: ceInstrument?.securityId || null,
                    tradingsymbol: ceInstrument?.tradingsymbol || null,
                    lotSize: ceInstrument?.lotSize || null,
                    tickSize: ceInstrument?.tickSize || null
                } : null,
                put: row.put ? {
                    ...row.put,
                    securityId: peInstrument?.securityId || null,
                    tradingsymbol: peInstrument?.tradingsymbol || null,
                    lotSize: peInstrument?.lotSize || null,
                    tickSize: peInstrument?.tickSize || null
                } : null
            };
        });

        return enrichedChain;

    } catch (error) {
        console.error('[enrichChainWithSecurityIds] Error:', error);
        // Return original chain if enrichment fails
        return chain;
    }
}

export { getOptionChain, getExpiryList, getOptionSecurityId };
