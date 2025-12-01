// routes/Auth.js
import express from 'express';
import { handleUserLogin, handleLogout } from '../Controllers/AuthController.js';
import { getBrokers, addBroker } from '../Controllers/SuperBrocker.js';
// getBrokerCustomers को CustomerController.js से इम्पोर्ट करें
import { 
  getBrokerCustomers, 
  addCustomer, 
  deleteCustomer,
  getDeletedCustomers,
  restoreCustomer,
  permanentDeleteCustomer
} from '../Controllers/CustomerController.js';
// IMPORTANT: JWT verification ke liye
import { protect } from '../Middleware/authMiddleware.js';

const router = express.Router();

// --- PUBLIC ROUTES ---
router.post('/login', handleUserLogin); 
router.post('/logout', handleLogout);
router.post('/add-broker', addBroker); 
router.get('/get-all-brocker', getBrokers);

// --- PROTECTED ROUTES ---
router.post('/addCustomer', protect, addCustomer); 
router.get('/getCustomers', protect, getBrokerCustomers);
router.delete('/deleteCustomer/:id', protect, deleteCustomer);

// --- RECYCLE BIN ROUTES ---
router.get('/deleted-customers', protect, getDeletedCustomers);
router.post('/restore-customer/:id', protect, restoreCustomer);
router.delete('/permanent-delete/:id', protect, permanentDeleteCustomer);

export default router;

                                                    
