// // Middleware/authMiddleware.js
// const jwt = require('jsonwebtoken');
// const asyncHandler = require('express-async-handler');
// const BrokerModel = require('../Model/BrokerModel');
// const CustomerModel = require('../Model/CustomerModel');

// const protect = asyncHandler(async (req, res, next) => {
//   let token;

//   // Token exists?
//   if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
//     try {
//       token = req.headers.authorization.split(" ")[1];

//       // Decode JWT
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       // decoded = { id: "...", role: "broker" | "customer" }
//       if (decoded.role === "broker") {
//         req.user = await BrokerModel.findById(decoded.id).select("-hashed_password");
//       } else if (decoded.role === "customer") {
//         req.user = await CustomerModel.findById(decoded.id).select("-hashed_password");
//       } else {
//         return res.status(403).json({ message: "Invalid role type" });
//       }

//       if (!req.user) {
//         return res.status(401).json({ message: "User not found in database" });
//       }

//       req.role = decoded.role;
//       next();
      
//     } catch (error) {
//       console.error("JWT Error:", error.message);
//       return res.status(401).json({ message: "Not authorized, token invalid" });
//     }
//   }

//   // No token found
//   if (!token) {
//     return res.status(401).json({ message: "Not authorized, no token" });
//   }
// });

// module.exports = { protect };








// Middleware/authMiddleware.js  (example if needed)
const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role }; // your payload keys
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid/expired token' });
  }
};
