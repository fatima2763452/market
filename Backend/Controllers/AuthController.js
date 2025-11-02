// Controllers/userAuthController.js
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const BrokerModel = require('../Model/BrokerModel');
const CustomerModel = require('../Model/CustomerModel');

// Utility: Generate JWT with 4 args (userId, role, mongoBrokerId, stringBrokerId)
const generateToken = (id, role, mongoBrokerId = null, stringBrokerId = null) => {
  const payload = { id, role, mongoBrokerId, stringBrokerId };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc     Handle User Login (Broker/Customer)
// @route    POST /api/auth/login
// @access   Public
const handleUserLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'enter your correct id and password' });
  }

  let user = null;
  let role = '';
  let attachedMongoBrokerId = null;       // Broker का Mongo _id (customer के case में attached broker)
  let associatedBrokerStringId = null;    // Broker का 10-digit login_id (string)

  // 1) Try Broker first (by login_id)
  // NOTE: अगर hashed_password schema में select:false है, तो उसे explicitly select करें
  user = await BrokerModel.findOne({ login_id: identifier }).select('+hashed_password');
  if (user) {
    role = 'broker';
    attachedMongoBrokerId = user._id;           // broker खुद ही "attached" broker है
    associatedBrokerStringId = user.login_id;   // broker का 10-digit id
  }

  // 2) Else try Customer (by customer_id)
  if (!user) {
    // attached_broker_id और hashed_password दोनों को ensure करें
    const customer = await CustomerModel.findOne({ customer_id: identifier })
      .select('+attached_broker_id +hashed_password');

    if (customer) {
      user = customer;
      role = 'customer';

      // Customer के साथ जुड़ा broker (Mongo _id)
      attachedMongoBrokerId = customer.attached_broker_id || null;

      // उस broker का 10-digit login_id निकालें
      if (attachedMongoBrokerId) {
        const brokerDetail = await BrokerModel.findById(attachedMongoBrokerId).select('login_id');
        if (brokerDetail) {
          associatedBrokerStringId = brokerDetail.login_id;
        }
      }
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'Invalid ID. User not found.' });
  }

  // 3) Password check (handle missing hashed_password safely)
  const hashed = user.hashed_password;
  if (!hashed) {
    // Schema में field का नाम अलग हुआ तो message दें (या यहां mapping जोड़ें)
    return res.status(500).json({
      success: false,
      message: 'Password field not available on user document.',
    });
  }

  const isMatch = await bcrypt.compare(password, hashed);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  // 4) Token payload के लिए final IDs
  const mongoBrokerId = role === 'broker' ? user._id : attachedMongoBrokerId;
  const stringBrokerId = role === 'broker' ? user.login_id : associatedBrokerStringId;

  // Safety: customer case में अगर broker mapping missing है
  if (role === 'customer' && (!mongoBrokerId || !stringBrokerId)) {
    return res.status(400).json({
      success: false,
      message: 'Customer is not attached to any valid broker.',
    });
  }

  // 5) Success response
  return res.status(200).json({
    success: true,
    message: `${role.charAt(0).toUpperCase() + role.slice(1)} login successful.`,
    token: generateToken(user._id, role, mongoBrokerId, stringBrokerId),
    name: user.name || user.fullName || user.customer_name || 'User',
    role,
    associatedBrokerStringId: stringBrokerId, // 10-digit broker id (frontend को भेजना ज़रूरी)
  });
});

module.exports = {
  handleUserLogin,
};
