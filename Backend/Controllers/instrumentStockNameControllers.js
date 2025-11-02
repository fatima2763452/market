const Instrument = require('../Model/InstrumentModel');

// ✅ Controller Function
const getStockName = async (req, res) => {
  try {
    const instruments = await Instrument.find(
      { segment: { $in: ["NSE_FO", "NSE_COM"] } }, // only F&O and Commodities
      { name: 1, _id: 0 }
    ).lean();

    const names = instruments.map(inst => inst.name).filter(Boolean);
    res.json({ count: names.length, names });
  } catch (err) {
    console.error('Error fetching instruments list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getStockName };






