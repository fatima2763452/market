const mongoose = require('mongoose');
const { Schema } = mongoose;

const FundsSchemas = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Har user ka sirf ek hi funds record hoga
    },
    available_cash: {
        type: Number,
        default: 0.00,
    },
    // Optional: Funds transfer history track karne ke liye array
    ledger_history: [{
        transaction_type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL', 'TRADE_FEE'] },
        amount: Number,
        timestamp: { type: Date, default: Date.now },
    }],
});

module.exports = mongoose.model('Funds', FundsSchemas);
