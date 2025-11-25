import express from "express";
import { protect } from "../Middleware/authMiddleware.js";
import UserWatchlist from "../Model/UserWatchlistModel.js";
import Instrument from "../Model/InstrumentModel.js";

const router = express.Router();

// @desc    Get user's watchlist
// @route   GET /api/watchlist
// @access  Private
// GET /api/watchlist
router.get("/getWatchlist", protect, async (req, res) => {
      console.log('wathclist api hit')

  try {
    // Read from query
    const { broker_id_str, customer_id_str } = req.query || {};

    if (!broker_id_str || !customer_id_str) {
      return res.status(400).json({ message: "broker_id_str and customer_id_str required" });
    }

    // FIND WATCHLIST USING broker + customer
    let watchlist = await UserWatchlist.findOne({
      broker_id_str: broker_id_str,
      customer_id_str: customer_id_str
    });

    // If no watchlist found → create one
    if (!watchlist) {
      watchlist = await UserWatchlist.create({
        broker_id_str,
        customer_id_str,
        instruments: []
      });
    }

    // Return instrument docs of all canon_keys in watchlist
    const instruments = await Instrument.find({
      canon_key: { $in: watchlist.instruments || [] }
    }).lean();

    return res.json({ success: true, instruments });

  } catch (error) {
    console.error("[watchlist-get] error:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});



// @desc    Add instrument to watchlist
// @route   POST /api/watchlist
// @access  Private
// POST /api/watchlist
// file reference (your uploaded image): file:///mnt/data/9917a0c3-fd52-4b8d-9f27-248f22f500af.png

router.post('/', protect, async (req, res) => {
  const { instrumentId, broker_id_str, customer_id_str } = req.body || {};

  if (!instrumentId) {
    return res.status(400).json({ message: 'Instrument ID is required' });
  }

  if (!broker_id_str || !customer_id_str) {
    return res.status(400).json({ success: false, message: "broker_id_str and customer_id_str required in body" });
  }

  try {
    // Resolve instrument (canon_key or ObjectId)
    let instrument = null;
    if (String(instrumentId).includes('|')) {
      instrument = await Instrument.findOne({ canon_key: instrumentId }).lean();
    } else {
      instrument = await Instrument.findById(instrumentId).lean();
    }

    if (!instrument) {
      return res.status(404).json({ message: 'Instrument not found' });
    }

    const canonKey = instrument.canon_key || instrument.canonKey;
    if (!canonKey) {
      return res.status(400).json({ message: 'Instrument has no canon_key' });
    }

    // Atomic upsert: add canonKey to instruments array (no duplicates)
    const query = { broker_id_str, customer_id_str };
    const update = {
      $addToSet: { instruments: canonKey },
      $setOnInsert: { broker_id_str, customer_id_str }
    };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    // try update, handle rare race duplicate by retry
    let watchlist;
    try {
      watchlist = await UserWatchlist.findOneAndUpdate(query, update, opts).lean();
    } catch (err) {
      if (err?.code === 11000) {
        // duplicate-key during upsert: small wait + retry findOneAndUpdate
        await new Promise(r => setTimeout(r, 100));
        watchlist = await UserWatchlist.findOneAndUpdate(query, update, opts).lean();
      } else {
        throw err;
      }
    }

    if (!watchlist) {
      // as fallback (very unlikely), create explicitly
      watchlist = await UserWatchlist.create({ broker_id_str, customer_id_str, instruments: [canonKey] });
    }

    // Return all instrument docs for the watchlist
    const instruments = await Instrument.find({
      canon_key: { $in: watchlist.instruments || [] }
    }).lean();

    return res.status(201).json(instruments);
  } catch (error) {
    console.error('[watchlist-post] error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
});


// @desc    Remove instrument from watchlist
// @route   DELETE /api/watchlist/:instrumentId
// @access  Private
// router.delete("/:instrumentId", protect, async (req, res) => { ... })
router.delete("/:instrumentId", protect, async (req, res) => {
  const { instrumentId } = req.params;
  // broker/customer (if needed) come as query params: ?broker_id_str=...&customer_id_str=...
  const { broker_id_str, customer_id_str } = req.query;

  try {
    // find user's watchlist
    const watchlist = await UserWatchlist.findOne({ user: req.user._id });
    if (!watchlist) {
      return res.status(404).json({ message: "Watchlist not found" });
    }

    // decide canonKeyToRemove
    let canonKeyToRemove = null;

    if (!instrumentId) {
      return res.status(400).json({ message: "instrumentId is required" });
    }

    if (instrumentId.includes("|")) {
      // already a canon_key
      canonKeyToRemove = instrumentId;
    } else {
      // treat as ObjectId (instrument _id) -> find instrument and read canon_key
      // use findById for _id lookup
      const instrument = await Instrument.findById(instrumentId).lean();
      if (!instrument) {
        return res.status(404).json({ message: "Instrument not found" });
      }
      canonKeyToRemove = instrument.canon_key || instrument.canonKey;
      if (!canonKeyToRemove) {
        return res.status(400).json({ message: "Instrument has no canon_key" });
      }
    }

    // Optional: verify broker/customer match (if you want to restrict)
    // if (broker_id_str && broker_id_str !== watchlist.broker_id_str) { ... }

    // Remove canonKey from watchlist.instruments atomically
    await UserWatchlist.updateOne(
      { user: req.user._id },
      { $pull: { instruments: canonKeyToRemove } }
    );

    // Reload watchlist instruments (fresh)
    const updatedWatchlist = await UserWatchlist.findOne({ user: req.user._id }).lean();

    // Return instrument details for remaining instruments
    const instruments = await Instrument.find({
      canon_key: { $in: updatedWatchlist?.instruments || [] },
    }).lean();

    return res.json({ success: true, instruments });
  } catch (error) {
    console.error("[watchlist-delete] error:", error);
    return res.status(500).json({ message: "Server Error", error: String(error) });
  }
});


export default router;
