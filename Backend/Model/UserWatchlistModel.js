import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserWatchlistSchema = new Schema({
  // user: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true,
  //   unique: true, // Each user has only one watchlist
  // },

  broker_id_str : {
    type : String,
    require : true
  },

  customer_id_str : {
    type : String,
    require : true
  },
  instruments: [{
    type: String, // canon_key format: "NSE|NSE_FNO|49081"
  }],
}, { timestamps: true });

export default mongoose.model('UserWatchlist', UserWatchlistSchema);