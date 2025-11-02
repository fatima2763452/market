const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrdersSchemas = new Schema({
    userId: { // Account kiska hai (Customer)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    initiated_by_id: { // Action kisne liya (Customer or Broker)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    symbol: String,
    qty: Number,
    price: Number,
    transaction_type: { // BUY ya SELL
        type: String,
        enum: ['BUY', 'SELL'],
        required: true,
    },
    order_status: { // Executed, Pending, Cancelled
        type: String,
        enum: ['PENDING', 'EXECUTED', 'CANCELLED'],
        default: 'PENDING',
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Orders', OrdersSchemas);
