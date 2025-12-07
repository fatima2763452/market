import mongoose from "mongoose";

const InstrumentSchema = new mongoose.Schema({
  canon_key: { type: String, unique: true, index: true }, // e.g. NSE|NSE_FNO|49081
  exchange: { type: String, index: true },
  segment: { type: String, index: true },         // NSE_FNO / MCX_COMM
  securityId: { type: String, index: true },
  tradingsymbol: { type: String, index: true },
  symbol_name: { type: String, index: true },
  display_name: String,
  underlying_symbol: { type: String, index: true },
  underlying_security_id: String,
  instrumentType: { type: String, index: true },  // FUT/OPT/EQ/CMDTY
  optionType: String,                              // CE/PE
  series: String,
  strike: Number,
  expiry: { type: Date, index: true },
  lotSize: Number,
  tickSize: Number,
  isin: { type: String, index: true },
  cross_broker: { upstox_instrument_key: { type: String, index: true } },
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

InstrumentSchema.index({ segment: 1, underlying_symbol: 1, expiry: 1, strike: 1, optionType: 1 });
InstrumentSchema.index({ segment: 1, tradingsymbol: 1 });
InstrumentSchema.index({ canon_key: 1 }, { unique: true }); // Optimized for watchlist batch lookups

const Instrument = mongoose.model("Instrument", InstrumentSchema, "instruments");
export default Instrument;