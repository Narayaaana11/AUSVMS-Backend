const express = require('express');
const { register, login, logout, profile, refresh } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/profile', protect, profile);

module.exports = router;


