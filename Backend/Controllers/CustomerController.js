// Controllers/CustomerController.js
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const CustomerModel = require('../Model/CustomerModel'); 
const BrokerModel = require('../Model/BrokerModel'); 

// Utility function to format date (e.g., to YYYY-MM-DD)
const formatDate = (date) => {
  if (!date) return 'N/A';
  // Mongoose standard field: createdAt
  return date.toISOString().split('T')[0];
};

// @desc    Broker adds a new customer
// @route   POST /api/auth/addCustomer
// @access  Private (Broker only, requires token)
const addCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user.id; 
  const { name, password } = req.body; 

  if (!name || !password) {
    res.status(400).json({ success: false, message: 'please enter id and password.' });
    return;
  }

  // 1. Hash Password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 2. Create New Customer
  const newCustomer = await CustomerModel.create({
    name,
    hashed_password: hashedPassword,
    attached_broker_id: brokerIdFromToken, 
    role: 'customer',
  });

  if (newCustomer) {
    res.status(201).json({
      success: true,
      message: 'New Cutomer successfully Added.',
      newCustomer: {
        id: newCustomer.customer_id, // 10-digit Customer ID
        name: newCustomer.name,
        joining_date: formatDate(newCustomer.createdAt), 
        status: 'Active', 
      },
    });
  } else {
    res.status(400).json({ success: false, message: 'Customer data invalid.' });
  }
});

// @desc    Broker gets a list of their attached customers
// @route   GET /api/auth/getCustomers
// @access  Private (Broker only, requires token)
const getBrokerCustomers = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user.id; 

  const customers = await CustomerModel
    .find({ attached_broker_id: brokerIdFromToken })
    .select('-hashed_password'); 

  const formattedCustomers = customers.map(customer => ({
    id: customer.customer_id,
    name: customer.name,
    joining_date: formatDate(customer.createdAt), 
    status: customer.status || 'Active', 
  }));

  res.status(200).json({
    success: true,
    customers: formattedCustomers,
    count: customers.length,
  });
});

// @desc    Broker deletes one of their attached customers
// @route   DELETE /api/auth/deleteCustomer/:id
// @access  Private (Broker only, requires token)
const deleteCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user.id;
  const customerIdToDelete = req.params.id; // 10-digit Customer ID

  // verify customer belongs to broker
  const customer = await CustomerModel.findOne({ 
    customer_id: customerIdToDelete, 
    attached_broker_id: brokerIdFromToken
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found or not linked to this broker.' });
  }

  await CustomerModel.deleteOne({ _id: customer._id });

  res.status(200).json({ 
    success: true, 
    message: 'Customer deleted successfully.',
    id: customerIdToDelete
  });
});

module.exports = {
  addCustomer,
  getBrokerCustomers,
  deleteCustomer,
};
