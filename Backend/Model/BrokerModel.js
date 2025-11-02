const mongoose = require('mongoose');
const { Schema } = mongoose;

// Helper function to generate a unique 10-digit ID for login
function generateId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const BrokerSchema = new Schema({
    // 🔑 PRIMARY LOGIN IDENTIFIER: Ab 'login_id' hai
    login_id: {
        type: String,
        required: true,
        unique: true,
        default: generateId, // ID will be auto-generated upon creation
    },
    
    hashed_password: {
        type: String,
        required: true,
    },
    
    name: {
        type: String,
        required: true,
    },
    
    // Broker ka role fixed hai
    role: {
        type: String,
        default: 'broker',
        immutable: true,
    },

    created_at: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Broker', BrokerSchema);