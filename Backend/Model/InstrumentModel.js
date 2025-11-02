const mongoose = require('mongoose');

const InstrumentSchema = new mongoose.Schema({
  instrument_key: { type: String, required: true, unique: true },
  exchange_token: String,
  tradingsymbol: String,
  name: String,
  last_price: String,
  expiry: String,
  strike: String,
  tick_size: String,
  lot_size: String,
  instrument_type: String,
  option_type: String,
  exchange: String,
  segment: String,
  asset_symbol: String,
  underlying_symbol: String,
  lot_size: String,
  qty_multiplier: String,
  isin: String,
  security_type: String,
  asset_key: String,
  underlying_key: String,
  mtf_enabled: String,
  mtf_bracket: String,
  // Add any other fields present in your data
}, { strict: false }); // strict: false allows extra fields

module.exports = mongoose.model('Instrument', InstrumentSchema);
