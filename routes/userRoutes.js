const express = require('express');
const { createUser, listUsers, deleteUser, updateUser, toggleActive, resetPassword, listStaffPublic } = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Public staff listing for appointment booking
router.get('/staff', listStaffPublic);

router.use(protect);
router.use(authorizeRoles('admin'));

router.post('/create', createUser);
router.get('/', listUsers);
router.delete('/:id', deleteUser);
router.patch('/:id', updateUser);
router.patch('/:id/toggle-active', toggleActive);
router.post('/:id/reset-password', resetPassword);

module.exports = router;


