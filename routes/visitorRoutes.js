const express = require('express');
const {
  createVisitor,
  getVisitor,
  listVisitors,
  updateVisitor,
  checkIn,
  checkOut,
  upload,
} = require('../controllers/visitorController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.post('/create', authorizeRoles('admin', 'security'), upload.single('photo'), createVisitor);
router.put('/checkin/:id', authorizeRoles('admin', 'security'), checkIn);
router.put('/checkout/:id', authorizeRoles('admin', 'security'), checkOut);
router.post('/exit', authorizeRoles('admin', 'security'), async (req, res, next) => {
  try {
    req.params.id = req.body.visitorId;
    return checkOut(req, res, next);
  } catch (e) {
    next(e);
  }
});
router.get('/:id', getVisitor);
router.get('/', listVisitors);
router.put('/:id', authorizeRoles('admin', 'security'), upload.single('photo'), updateVisitor);

module.exports = router;


