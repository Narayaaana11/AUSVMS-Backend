const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getStats, getVisitorLogs, exportVisitorLogs } = require('../controllers/adminController');

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('admin'));

router.get('/stats', getStats);
router.get('/visitor-logs', getVisitorLogs);
router.get('/visitor-logs/export', exportVisitorLogs);

module.exports = router;


