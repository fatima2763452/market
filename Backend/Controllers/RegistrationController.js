// Controllers/RegistrationController.js
// Handles new user registration requests

import asyncHandler from 'express-async-handler';
import { sendRegistrationToTelegram } from '../services/telegramService.js';

/**
 * @desc    Submit a new registration request
 * @route   POST /api/registration/submit
 * @access  Public
 */
const submitRegistration = asyncHandler(async (req, res) => {
  console.log('[Registration] New submission received');

  // Extract form data from request body
  const {
    firstName,
    middleName,
    lastName,
    mobileNumber,
    whatsappNumber,
    email,
    nameAsPerAadhaar,
    aadhaarNumber,
    panNumber,
    permanentAddress,
  } = req.body;

  // Validate required fields
  const requiredFields = {
    firstName: 'First name',
    lastName: 'Last name',
    mobileNumber: 'Mobile number',
    whatsappNumber: 'WhatsApp number',
    email: 'Email',
    nameAsPerAadhaar: 'Name as per Aadhaar',
    aadhaarNumber: 'Aadhaar number',
    panNumber: 'PAN number',
    permanentAddress: 'Permanent address',
  };

  const missingFields = [];
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!req.body[field]) {
      missingFields.push(label);
    }
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }

  // Validate file uploads
  const files = req.files || {};
  
  if (!files.aadhaarFront) {
    return res.status(400).json({ success: false, message: 'Aadhaar front image is required' });
  }
  if (!files.aadhaarBack) {
    return res.status(400).json({ success: false, message: 'Aadhaar back image is required' });
  }
  if (!files.panCard) {
    return res.status(400).json({ success: false, message: 'PAN card image is required' });
  }

  console.log('[Registration] Form data validated');
  console.log('[Registration] Files received:', Object.keys(files));

  // Prepare files for Telegram
  const getFileExt = (mimetype) => {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/jpg': 'jpg' };
    return map[mimetype] || 'jpg';
  };

  const telegramFiles = {
    aadhaarFront: files.aadhaarFront ? {
      buffer: files.aadhaarFront[0].buffer,
      ext: getFileExt(files.aadhaarFront[0].mimetype),
    } : null,
    aadhaarBack: files.aadhaarBack ? {
      buffer: files.aadhaarBack[0].buffer,
      ext: getFileExt(files.aadhaarBack[0].mimetype),
    } : null,
    panCard: files.panCard ? {
      buffer: files.panCard[0].buffer,
      ext: getFileExt(files.panCard[0].mimetype),
    } : null,
    passportPhoto: files.passportPhoto ? {
      buffer: files.passportPhoto[0].buffer,
      ext: getFileExt(files.passportPhoto[0].mimetype),
    } : null,
  };

  // Send to Telegram
  const telegramResult = await sendRegistrationToTelegram(
    {
      firstName,
      middleName: middleName || '',
      lastName,
      mobileNumber,
      whatsappNumber,
      email,
      nameAsPerAadhaar,
      aadhaarNumber,
      panNumber,
      permanentAddress,
    },
    telegramFiles
  );

  if (!telegramResult.success) {
    console.error('[Registration] Failed to send to Telegram:', telegramResult.error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit registration. Please try again.',
      error: telegramResult.error,
    });
  }

  console.log('[Registration] Successfully sent to Telegram');

  res.status(200).json({
    success: true,
    message: 'Registration submitted successfully! We will review your application and contact you soon.',
  });
});

export { submitRegistration };
