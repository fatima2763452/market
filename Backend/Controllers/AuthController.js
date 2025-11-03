// Controllers/userAuthController.js
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const BrokerModel = require('../Model/BrokerModel');
const CustomerModel = require('../Model/CustomerModel');

// ------------------ TOKEN BLACKLIST (in-memory) ------------------
// NOTE: Prod me Redis/Mongo TTL use karein. Yeh in-memory server restart par reset ho jayega.
const tokenBlacklist = new Map(); // token -> expiresAt(ms)

const addToBlacklist = (token, expUnixSeconds) => {
  const expiresAtMs = expUnixSeconds * 1000;
  tokenBlacklist.set(token, expiresAtMs);

  // auto cleanup when token naturally expires
  const delay = Math.max(0, expiresAtMs - Date.now());
  setTimeout(() => tokenBlacklist.delete(token), delay);
};

const isTokenBlacklisted = (token) => {
  const ts = tokenBlacklist.get(token);
  if (!ts) return false;
  if (Date.now() > ts) {
    tokenBlacklist.delete(token);
    return false;
  }
  return true;
};
// -----------------------------------------------------------------

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
  user = await BrokerModel.findOne({ login_id: identifier }).select('+hashed_password');
  if (user) {
    role = 'broker';
    attachedMongoBrokerId = user._id;
    associatedBrokerStringId = user.login_id;
  }

  // 2) Else try Customer (by customer_id)
  if (!user) {
    const customer = await CustomerModel.findOne({ customer_id: identifier })
      .select('+attached_broker_id +hashed_password');

    if (customer) {
      user = customer;
      role = 'customer';
      attachedMongoBrokerId = customer.attached_broker_id || null;

      if (attachedMongoBrokerId) {
        const brokerDetail = await BrokerModel.findById(attachedMongoBrokerId).select('login_id');
        if (brokerDetail) associatedBrokerStringId = brokerDetail.login_id;
      }
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'Invalid ID. User not found.' });
  }

  const hashed = user.hashed_password;
  if (!hashed) {
    return res.status(500).json({
      success: false,
      message: 'Password field not available on user document.',
    });
  }

  const isMatch = await bcrypt.compare(password, hashed);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const mongoBrokerId = role === 'broker' ? user._id : attachedMongoBrokerId;
  const stringBrokerId = role === 'broker' ? user.login_id : associatedBrokerStringId;

  if (role === 'customer' && (!mongoBrokerId || !stringBrokerId)) {
    return res.status(400).json({
      success: false,
      message: 'Customer is not attached to any valid broker.',
    });
  }

  return res.status(200).json({
    success: true,
    message: `${role.charAt(0).toUpperCase() + role.slice(1)} login successful.`,
    token: generateToken(user._id, role, mongoBrokerId, stringBrokerId),
    name: user.name || user.fullName || user.customer_name || 'User',
    role,
    associatedBrokerStringId: stringBrokerId,
  });
});

// @desc     Logout current token (blacklist until it naturally expires)
// @route    POST /api/auth/logout
// @access   Private (requires Bearer token)
const handleLogout = asyncHandler(async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(400).json({ success: false, message: 'No token provided.' });
  }

  try {
    // verify to read exp
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (isTokenBlacklisted(token)) {
      return res.status(200).json({ success: true, message: 'Already logged out.' });
    }

    addToBlacklist(token, decoded.exp);
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    // If token already expired/invalid, still return OK (idempotent UX)
    return res.status(200).json({ success: true, message: 'Logged out.' });
  }
});

// (optional) export helper for your auth middleware
const isBlacklisted = (token) => isTokenBlacklisted(token);

module.exports = {
  handleUserLogin,
  handleLogout,
  isBlacklisted,
};
