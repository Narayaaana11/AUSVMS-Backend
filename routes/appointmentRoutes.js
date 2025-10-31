const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { approve, create } = require('../controllers/appointmentController');

const router = express.Router();

// Public create endpoint (no auth needed)
router.post('/create', create);

// Protected admin/security actions
router.use(protect);
router.post('/:id/approve', authorizeRoles('admin', 'security'), approve);

module.exports = router;


