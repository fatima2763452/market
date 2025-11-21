import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserWatchlistSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user has only one watchlist
  },
  instruments: [{
    type: String, // canon_key format: "NSE|NSE_FNO|49081"
  }],
}, { timestamps: true });

export default mongoose.model('UserWatchlist', UserWatchlistSchema);
