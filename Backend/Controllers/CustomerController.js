// Controllers/CustomerController.js
import asyncHandler from 'express-async-handler';
import CustomerModel from '../Model/CustomerModel.js';
import BrokerModel from '../Model/BrokerModel.js';
import DeletedCustomerModel from '../Model/DeletedCustomerModel.js';

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

  // Create New Customer - Password stored as plain text
  const newCustomer = await CustomerModel.create({
    name,
    password: password,
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
    .select('-password'); 

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

// @desc    Broker soft-deletes a customer (moves to recycle bin)
// @route   DELETE /api/auth/deleteCustomer/:id
// @access  Private (Broker only, requires token)
const deleteCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id; // Use _id for MongoDB ObjectId
  const customerIdToDelete = req.params.id; // 10-digit Customer ID

  console.log('[deleteCustomer] Broker ID:', brokerIdFromToken);
  console.log('[deleteCustomer] Customer ID to delete:', customerIdToDelete);

  // Verify customer belongs to broker
  const customer = await CustomerModel.findOne({ 
    customer_id: customerIdToDelete, 
    attached_broker_id: brokerIdFromToken
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found or not linked to this broker.' });
  }

  console.log('[deleteCustomer] Found customer:', customer.name, customer.customer_id);

  // Archive customer to DeletedCustomer collection (Recycle Bin)
  const archivedCustomer = await DeletedCustomerModel.create({
    customer_id: customer.customer_id,
    password: customer.password, // Plain text password preserved
    name: customer.name,
    role: customer.role,
    attached_broker_id: customer.attached_broker_id,
    original_id: customer._id,
    deleted_at: new Date(),
    deleted_by: brokerIdFromToken,
    original_created_at: customer.createdAt,
  });

  console.log('[deleteCustomer] Archived customer created:', archivedCustomer._id);

  // Delete from Customer collection
  await CustomerModel.deleteOne({ _id: customer._id });

  res.status(200).json({ 
    success: true, 
    message: 'Customer moved to Recycle Bin.',
    id: customerIdToDelete
  });
});

// @desc    Broker gets list of deleted customers (Recycle Bin)
// @route   GET /api/auth/deleted-customers
// @access  Private (Broker only, requires token)
const getDeletedCustomers = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;

  console.log('[getDeletedCustomers] Broker ID:', brokerIdFromToken);

  const deletedCustomers = await DeletedCustomerModel
    .find({ attached_broker_id: brokerIdFromToken })
    .sort({ deleted_at: -1 }); // Most recent first

  console.log('[getDeletedCustomers] Found:', deletedCustomers.length, 'deleted customers');

  const formattedCustomers = deletedCustomers.map(customer => ({
    id: customer.customer_id,
    name: customer.name,
    password: customer.password, // Plain text password visible to broker
    joining_date: formatDate(customer.original_created_at),
    deleted_date: formatDate(customer.deleted_at),
    original_id: customer.original_id,
  }));

  res.status(200).json({
    success: true,
    deletedCustomers: formattedCustomers,
    count: deletedCustomers.length,
  });
});

// @desc    Broker restores a deleted customer from Recycle Bin
// @route   POST /api/auth/restore-customer/:id
// @access  Private (Broker only, requires token)
const restoreCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;
  const customerIdToRestore = req.params.id; // 10-digit Customer ID

  // Find in DeletedCustomer collection
  const deletedCustomer = await DeletedCustomerModel.findOne({
    customer_id: customerIdToRestore,
    attached_broker_id: brokerIdFromToken
  });

  if (!deletedCustomer) {
    return res.status(404).json({ success: false, message: 'Deleted customer not found.' });
  }

  // Check if customer_id already exists in Customer collection
  const existingCustomer = await CustomerModel.findOne({ customer_id: customerIdToRestore });
  if (existingCustomer) {
    return res.status(400).json({ success: false, message: 'A customer with this ID already exists. Cannot restore.' });
  }

  // Restore customer to Customer collection
  await CustomerModel.create({
    customer_id: deletedCustomer.customer_id,
    password: deletedCustomer.password,
    name: deletedCustomer.name,
    role: deletedCustomer.role,
    attached_broker_id: deletedCustomer.attached_broker_id,
  });

  // Remove from DeletedCustomer collection
  await DeletedCustomerModel.deleteOne({ _id: deletedCustomer._id });

  res.status(200).json({
    success: true,
    message: 'Customer restored successfully.',
    id: customerIdToRestore
  });
});

// @desc    Broker permanently deletes a customer from Recycle Bin
// @route   DELETE /api/auth/permanent-delete/:id
// @access  Private (Broker only, requires token)
const permanentDeleteCustomer = asyncHandler(async (req, res) => {
  const brokerIdFromToken = req.user._id;
  const customerIdToDelete = req.params.id; // 10-digit Customer ID

  // Find in DeletedCustomer collection
  const deletedCustomer = await DeletedCustomerModel.findOne({
    customer_id: customerIdToDelete,
    attached_broker_id: brokerIdFromToken
  });

  if (!deletedCustomer) {
    return res.status(404).json({ success: false, message: 'Deleted customer not found.' });
  }

  // Permanently delete
  await DeletedCustomerModel.deleteOne({ _id: deletedCustomer._id });

  res.status(200).json({
    success: true,
    message: 'Customer permanently deleted.',
    id: customerIdToDelete
  });
});

export { 
  addCustomer, 
  getBrokerCustomers, 
  deleteCustomer, 
  getDeletedCustomers, 
  restoreCustomer, 
  permanentDeleteCustomer 
};
