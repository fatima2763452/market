import mongoose from 'mongoose';
const { Schema } = mongoose;

const DeletedCustomerSchema = new Schema({
    // Original customer data
    customer_id: {
        type: String,
        required: true,
    },
    
    password: {
        type: String,
        required: true,
    },
    
    name: {
        type: String,
        required: true,
    },
    
    role: {
        type: String,
        default: 'customer',
    },
    
    // 🔗 BROKER LINKAGE: Which broker this customer belonged to
    attached_broker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Broker',
        required: true,
    },
    
    // 🗑️ DELETION INFO
    original_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // Original MongoDB _id from Customer collection
    },
    
    deleted_at: {
        type: Date,
        default: Date.now,
    },
    
    deleted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Broker', // Broker who deleted this customer
        required: true,
    },
    
    // Original creation date (preserved from Customer)
    original_created_at: {
        type: Date,
        required: true,
    },

}, { timestamps: true }); // createdAt here = when moved to recycle bin

export default mongoose.model('DeletedCustomer', DeletedCustomerSchema);
