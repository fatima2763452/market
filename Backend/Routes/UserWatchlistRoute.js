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
    const watchlist = await UserWatchlist.findOne({ user: req.user._id }).populate('instruments');
    if (watchlist) {
      res.json(watchlist.instruments);
    } else {
      // If no watchlist, create one for the user
      const newWatchlist = await UserWatchlist.create({ user: req.user._id, instruments: [] });
      res.json(newWatchlist.instruments);
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
  const { instrumentId } = req.body; // Expecting the ObjectId of the instrument

  if (!instrumentId) {
    return res.status(400).json({ message: 'Instrument ID is required' });
  }

  try {
    const instrument = await Instrument.findById(instrumentId);
    if (!instrument) {
      return res.status(404).json({ message: 'Instrument not found' });
    }

    let watchlist = await UserWatchlist.findOne({ user: req.user._id });

    if (!watchlist) {
      watchlist = await UserWatchlist.create({ user: req.user._id, instruments: [] });
    }

    // Check if instrument is already in the watchlist
    const alreadyAdded = watchlist.instruments.some(
      (inst) => inst.toString() === instrumentId
    );

    if (alreadyAdded) {
      return res.status(400).json({ message: 'Instrument already in watchlist' });
    }

    watchlist.instruments.push(instrumentId);
    await watchlist.save();

    const populatedWatchlist = await UserWatchlist.findById(watchlist._id).populate('instruments');
    res.status(201).json(populatedWatchlist.instruments);
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

    watchlist.instruments = watchlist.instruments.filter(
      (inst) => inst.toString() !== instrumentId
    );

    await watchlist.save();
    
    const populatedWatchlist = await UserWatchlist.findById(watchlist._id).populate('instruments');
    res.json(populatedWatchlist.instruments);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
