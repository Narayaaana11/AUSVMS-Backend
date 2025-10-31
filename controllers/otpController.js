const createError = require('http-errors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const OTP = require('../models/OTP');
const Visitor = require('../models/Visitor');
const { sendWhatsApp, sendEmail } = require('../utils/notify');
const AuditLog = require('../models/AuditLog');

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

exports.generate = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) return next(createError(400, 'appointmentId is required'));
    const visitor = await Visitor.findById(appointmentId);
    if (!visitor) return next(createError(404, 'Appointment/visitor not found'));

    // Invalidate previous unused OTPs for this appointment
    await OTP.updateMany({ appointmentId: visitor._id, used: false }, { $set: { used: true } });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(otp, salt);
    const ttlMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 15);
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();

    const record = await OTP.create({ appointmentId: visitor._id, codeHash, expiresAt });

    // Send WhatsApp message (best-effort)
    const dateStr = dayjs(visitor.createdAt).format('YYYY-MM-DD');
    const timeStr = dayjs(visitor.createdAt).format('HH:mm');
    const body = `Hello ${visitor.name},\nYour appointment with ${visitor.personToMeet} on ${dateStr} at ${timeStr} has been approved.\nYour OTP for entry is: ${otp}\nPlease show this OTP to the security guard for campus entry.\n- Aditya University`;
    sendWhatsApp({ to: visitor.contactNumber, message: body }).catch(() => {});
    // Send Email (best-effort)
    if (visitor.email) {
      sendEmail({ to: visitor.email, subject: 'Your Aditya University Appointment OTP', html: `<p>Hello ${visitor.name},</p><p>Your appointment with <b>${visitor.personToMeet}</b> on <b>${dateStr}</b> at <b>${timeStr}</b> has been approved.</p><p>Your OTP for campus entry is: <b>${otp}</b></p><p>This OTP is valid for ${ttlMinutes} minutes.</p>` }).catch(() => {});
    }

    // Audit
    AuditLog.create({ actorId: req.user?._id, action: 'otp.generate', resource: String(visitor._id), details: { via: ['whatsapp', !!visitor.email && 'email'].filter(Boolean), expiresAt } }).catch(() => {});

    res.status(201).json({ id: record._id, success: true });
  } catch (err) {
    next(err);
  }
};

exports.verify = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return next(createError(400, 'otp is required'));
    // Find latest unused OTP that matches by brute-force comparing hash (limited set)
    const candidates = await OTP.find({ used: false, expiresAt: { $gte: new Date() } }).sort({ createdAt: -1 }).limit(500);
    let matched = null;
    for (const rec of candidates) {
      const ok = await bcrypt.compare(String(otp), rec.codeHash);
      if (ok) { matched = rec; break; }
    }
    if (!matched) {
      // audit invalid attempt
      AuditLog.create({ actorId: req.user?._id, action: 'otp.verify.invalid', resource: 'otp', details: { otp } }).catch(() => {});
      return next(createError(400, 'Invalid or expired OTP'));
    }

    // Increment attempts and enforce limit
    matched.attempts = (matched.attempts || 0) + 1;
    if (matched.attempts > Number(process.env.OTP_MAX_ATTEMPTS || 3)) {
      matched.used = true; // lock it
      await matched.save();
      AuditLog.create({ actorId: req.user?._id, action: 'otp.verify.locked', resource: String(matched._id), details: { attempts: matched.attempts } }).catch(() => {});
      return next(createError(400, 'OTP attempts exceeded'));
    }

    const visitor = await Visitor.findById(matched.appointmentId);
    if (!visitor) return next(createError(404, 'Appointment/visitor not found'));
    if (visitor.status === 'checked-in') return next(createError(400, 'OTP already used'));

    // Mark entry
    visitor.status = 'checked-in';
    visitor.checkInAt = new Date();
    await visitor.save();
    matched.used = true;
    await matched.save();

    AuditLog.create({ actorId: req.user?._id, action: 'otp.verify.success', resource: String(visitor._id) }).catch(() => {});

    res.json({ success: true, visitorId: visitor._id });
  } catch (err) {
    next(err);
  }
};


