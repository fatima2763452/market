// routes/Auth.js
const express = require('express');
const router = express.Router();
const { handleUserLogin , handleLogout} = require('../Controllers/AuthController');
const { getBrokers, addBroker } = require('../Controllers/SuperBrocker');
// getBrokerCustomers को CustomerController.js से इम्पोर्ट करें
const { getBrokerCustomers, addCustomer , deleteCustomer } = require('../Controllers/CustomerController'); 
// IMPORTANT: JWT verification ke liye
const { protect } = require('../Middleware/authMiddleware'); 

// --- PUBLIC ROUTES ---
router.post('/login', handleUserLogin); 
router.post('/logout', handleLogout);
router.post('/add-broker', addBroker); 
router.get('/get-all-brocker', getBrokers);

// --- PROTECTED ROUTES ---
router.post('/addCustomer', protect, addCustomer); 
router.get('/getCustomers', protect, getBrokerCustomers);
router.delete('/deleteCustomer/:id', protect, deleteCustomer);

module.exports = router;
