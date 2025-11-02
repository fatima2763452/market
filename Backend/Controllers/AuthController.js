// Controllers/userAuthController.js
const asyncHandler = require('express-async-handler');

// Utility function to generate JWT Token (MUST BE UPDATED TO ACCEPT 4 ARGUMENTS)
const generateToken = (id, role, mongoBrokerId = null, stringBrokerId = null) => {
    // The payload now includes the Customer's string broker ID
    const payload = { id, role, mongoBrokerId, stringBrokerId }; 
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Handle User Login (Broker/Customer)
// @route   POST /api/auth/login
// @access  Public
const handleUserLogin = asyncHandler(async (req, res) => {
    const { identifier, password } = req.body; 
    
    if (!identifier || !password) {
        res.status(400).json({ success: false, message: 'enter your correct id and password' });
        return;
    }

    let user = null;
    let role = '';
    let attachedMongoBrokerId = null; // Stores the Mongoose ObjectId of the Broker
    let associatedBrokerStringId = null; // Stores the 10-digit login_id of the Broker

    // 1. Try to find Broker (Broker's own login)
    user = await BrokerModel.findOne({ login_id: identifier });
    if (user) {
        role = 'broker';
    }

    // 2. If not a Broker, try to find Customer
    if (!user) {
        // Find Customer and explicitly select the attached_broker_id field
        user = await CustomerModel.findOne({ customer_id: identifier }).select('+attached_broker_id'); 
        
        if (user) {
            role = 'customer';
            attachedMongoBrokerId = user.attached_broker_id;

            // CRITICAL STEP: Fetch the 10-digit login_id of the associated Broker
            const brokerDetail = await BrokerModel.findById(attachedMongoBrokerId).select('login_id');
            
            if (brokerDetail) {
                associatedBrokerStringId = brokerDetail.login_id;
            }
        }
    }

    if (!user) {
        res.status(404).json({ success: false, message: 'Invalid ID. User not found.' });
        return;
    }

    // Check Password and generate token
    if (await bcrypt.compare(password, user.hashed_password)) {
        
        // Determine the string ID of the active broker for the token payload
        const stringBrokerId = (role === 'broker') ? user.login_id : associatedBrokerStringId;

        res.status(200).json({
            success: true,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} login successful.`,
            // FIX: Pass both IDs to token generation
            token: generateToken(user._id, role, attachedMongoBrokerId, stringBrokerId), 
            name: user.name,
            role: role, 
            // Send the 10-digit Broker ID to the frontend response
            associatedBrokerStringId: stringBrokerId, 
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
});


module.exports = {
    handleUserLogin,
};