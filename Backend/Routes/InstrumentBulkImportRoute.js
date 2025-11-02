const express = require('express');
const router = express.Router();
const fs = require('fs');
const Instrument = require('../Model/InstrumentModel');

// POST /api/instruments/bulk-import
router.post('/instruments/bulk-import', async (req, res) => {
  try {
    console.log('Deleting existing instruments...');
    await Instrument.deleteMany({});

    console.log('Reading new data...');
    const data = JSON.parse(fs.readFileSync('nse_bse_fno_data.json', 'utf-8'));

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to import.' });
    }

    console.log(`Inserting ${data.length} new instruments...`);
    const result = await Instrument.insertMany(data, { ordered: false });

    res.json({ message: `Inserted ${result.length} instruments into MongoDB.` });
  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({
      error: err.writeErrors
        ? `${err.writeErrors.length} duplicate/invalid records skipped.`
        : err.message
    });
  }
});

module.exports = router;
