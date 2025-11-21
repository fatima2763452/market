import express from 'express';
import { protect } from '../Middleware/authMiddleware.js';
import UserWatchlist from '../Model/UserWatchlistModel.js';
import Instrument from '../Model/InstrumentModel.js';

const router = express.Router();

// @desc    Get user's watchlist
// @route   GET /api/watchlist
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const watchlist = await UserWatchlist.findOne({ user: req.user._id });
    if (watchlist) {
      // Lookup instruments by canon_key
      const instruments = await Instrument.find({
        canon_key: { $in: watchlist.instruments }
      });
      res.json(instruments);
    } else {
      // If no watchlist, create one for the user
      await UserWatchlist.create({ user: req.user._id, instruments: [] });
      res.json([]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add instrument to watchlist
// @route   POST /api/watchlist
// @access  Private
router.post('/', protect, async (req, res) => {
  const { instrumentId } = req.body; // Expecting the ObjectId or canon_key of the instrument

  if (!instrumentId) {
    return res.status(400).json({ message: 'Instrument ID is required' });
  }

  try {
    // Find instrument by ObjectId or canon_key
    let instrument;
    if (instrumentId.includes('|')) {
      // canon_key format: "NSE|NSE_FNO|49081"
      instrument = await Instrument.findOne({ canon_key: instrumentId });
    } else {
      // ObjectId format
      instrument = await Instrument.findById(instrumentId);
    }

    if (!instrument) {
      return res.status(404).json({ message: 'Instrument not found' });
    }

    let watchlist = await UserWatchlist.findOne({ user: req.user._id });

    if (!watchlist) {
      watchlist = await UserWatchlist.create({ user: req.user._id, instruments: [] });
    }

    // Check if instrument is already in the watchlist using canon_key
    const alreadyAdded = watchlist.instruments.includes(instrument.canon_key);

    if (alreadyAdded) {
      return res.status(400).json({ message: 'Instrument already in watchlist' });
    }

    watchlist.instruments.push(instrument.canon_key);
    await watchlist.save();

    // Return all instruments
    const instruments = await Instrument.find({
      canon_key: { $in: watchlist.instruments }
    });
    res.status(201).json(instruments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Remove instrument from watchlist
// @route   DELETE /api/watchlist/:instrumentId
// @access  Private
router.delete('/:instrumentId', protect, async (req, res) => {
  const { instrumentId } = req.params;

  try {
    const watchlist = await UserWatchlist.findOne({ user: req.user._id });

    if (!watchlist) {
      return res.status(404).json({ message: 'Watchlist not found' });
    }

    // Find instrument to get its canon_key
    let canonKeyToRemove;
    if (instrumentId.includes('|')) {
      // Already canon_key format
      canonKeyToRemove = instrumentId;
    } else {
      // ObjectId format - lookup canon_key
      const instrument = await Instrument.findById(instrumentId);
      if (instrument) {
        canonKeyToRemove = instrument.canon_key;
      }
    }

    if (canonKeyToRemove) {
      watchlist.instruments = watchlist.instruments.filter(
        (canonKey) => canonKey !== canonKeyToRemove
      );
      await watchlist.save();
    }

    // Return updated watchlist
    const instruments = await Instrument.find({
      canon_key: { $in: watchlist.instruments }
    });
    res.json(instruments);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
