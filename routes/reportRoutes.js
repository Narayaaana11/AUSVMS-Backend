const express = require('express');
const { dailyReport, monthlyReport, exportLogs } = require('../controllers/reportController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('admin'));

router.get('/daily', dailyReport);
router.get('/monthly', monthlyReport);
router.get('/export', exportLogs);

module.exports = router;


