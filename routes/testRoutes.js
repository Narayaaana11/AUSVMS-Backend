const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/notify');

const router = express.Router();

router.get('/email', async (req, res) => {
  const to = req.query.to || process.env.EMAIL_USER;
  const ok = await sendEmail({ to, subject: 'AUVMS Test Email', html: '<p>This is a test email from AUVMS.</p>' }).catch(() => false);
  res.json({ success: !!ok });
});

module.exports = router;


