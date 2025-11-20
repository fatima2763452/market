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
    type: Schema.Types.ObjectId,
    ref: 'Instrument',
  }],
}, { timestamps: true });

export default mongoose.model('UserWatchlist', UserWatchlistSchema);
