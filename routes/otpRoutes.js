const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { generate, verify } = require('../controllers/otpController');

const router = express.Router();

router.use(protect);

// Staff/admin can generate OTP upon approval
router.post('/generate', authorizeRoles('admin', 'security'), generate);

// Guards verify OTP at gate
router.post('/verify', authorizeRoles('admin', 'security'), verify);

module.exports = router;


