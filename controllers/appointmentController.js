const createError = require('http-errors');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const crypto = require('crypto');
const Visitor = require('../models/Visitor');
const Appointment = require('../models/Appointment');
const OTP = require('../models/OTP');
const { sendEmail, sendWhatsApp } = require('../utils/notify');
const AuditLog = require('../models/AuditLog');

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

exports.approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findById(id);
    if (!visitor) return next(createError(404, 'Appointment/visitor not found'));

    // Mark approved (retain existing states if already checked-in)
    if (!visitor.checkInAt) {
      visitor.status = 'created'; // keep pipeline; approval tracked via OTP issuance
      await visitor.save();
    }

    // Invalidate previous OTPs
    await OTP.updateMany({ appointmentId: visitor._id, used: false }, { $set: { used: true } });

    const otp = generateOTP();
    const codeHash = await bcrypt.hash(otp, 10);
    const ttlMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 15);
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();
    const record = await OTP.create({ appointmentId: visitor._id, codeHash, expiresAt });
    visitor.otpRef = record._id;
    await visitor.save();

    const dateStr = dayjs(visitor.createdAt).format('YYYY-MM-DD');
    const timeStr = dayjs(visitor.createdAt).format('HH:mm');
    const text = `Hello ${visitor.name},\nYour appointment with ${visitor.personToMeet} on ${dateStr} at ${timeStr} has been approved.\nYour OTP for campus entry is: ${otp}\nThis OTP is valid for ${ttlMinutes} minutes.`;
    const html = `<p>Hello ${visitor.name},</p><p>Your appointment with <b>${visitor.personToMeet}</b> on <b>${dateStr}</b>, <b>${timeStr}</b> has been approved.</p><p>Your OTP for campus entry is: <b>${otp}</b></p><p>This OTP is valid for ${ttlMinutes} minutes.</p>`;

    // send email
    if (visitor.email) {
      sendEmail({ to: visitor.email, subject: 'Your Aditya University Appointment OTP', html }).catch(() => {});
    }
    // optional whatsapp
    sendWhatsApp({ to: visitor.contactNumber, message: text }).catch(() => {});

    AuditLog.create({ actorId: req.user?._id, action: 'appointment.approve', resource: String(visitor._id), details: { otpId: String(record._id) } }).catch(() => {});

    res.json({ success: true, message: 'OTP generated and sent', otpId: record._id });
  } catch (err) {
    next(err);
  }
};


exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Backward compatibility: map old VisitorForm payload to new schema
    // Old shape keys: name, email, phone, purpose, staffId/personToMeetId, personToMeetName
    let visitorName = body.visitorName || body.name;
    let visitorEmail = body.visitorEmail || body.email;
    let visitorPhone = body.visitorPhone || body.phone;
    let purpose = body.purpose || body.purposeOfVisit;
    let personToMeet = body.personToMeet;
    let attendees = body.attendees;

    const staffId = body.staffId || body.personToMeetId;
    const personToMeetName = body.personToMeetName;

    // Resolve personToMeet from staffId if provided
    if (!personToMeet && (staffId || personToMeetName)) {
      if (personToMeetName) {
        personToMeet = personToMeetName;
      } else if (staffId) {
        try {
          const User = require('../models/User');
          const u = await User.findById(staffId).select('name');
          personToMeet = u?.name || String(staffId);
        } catch {
          personToMeet = String(staffId);
        }
      }
    }

    if (!visitorName || !visitorEmail || !visitorPhone || !purpose || !personToMeet) {
      return next(createError(400, 'Missing required fields'));
    }

    // Validate attendees array and prevent duplicate phones
    const attendeesList = Array.isArray(attendees) && attendees.length
      ? attendees
      : [{ name: visitorName, phone: visitorPhone }];

    const sanitizedAttendees = attendeesList.map((a) => ({
      name: String(a.name || '').trim(),
      phone: String(a.phone || '').trim(),
    }));

    if (sanitizedAttendees.some((a) => !a.name || !/^\d{10}$/.test(a.phone))) {
      return next(createError(400, 'Invalid attendee details'));
    }

    const phoneSet = new Set();
    for (const a of sanitizedAttendees) {
      if (phoneSet.has(a.phone)) return next(createError(400, 'Duplicate attendee phone numbers'));
      phoneSet.add(a.phone);
    }

    // Create appointment
    const appointment = await Appointment.create({
      visitorName: String(visitorName).trim(),
      visitorEmail: String(visitorEmail).trim().toLowerCase(),
      visitorPhone: String(visitorPhone).trim(),
      purpose: String(purpose).trim(),
      personToMeet: String(personToMeet).trim(),
      attendees: sanitizedAttendees,
      status: 'pending',
    });

    // Admission Office fast-track
    if (appointment.personToMeet.toLowerCase() === 'admission office') {
      const otp = String(crypto.randomInt(100000, 999999));
      const codeHash = await bcrypt.hash(otp, 10);
      const ttlMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 15);
      const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();
      const otpRecord = await OTP.create({ appointmentId: appointment._id, codeHash, expiresAt });
      appointment.status = 'approved';
      appointment.otpRef = otpRecord._id;
      await appointment.save();

      // Email template for Admission OTP
      const subject = 'Your Aditya University Admission OTP';
      const html = `<p>Dear ${appointment.visitorName},</p>
        <p>Your appointment for Admission Enquiry is confirmed.</p>
        <p>Your OTP for entry is: <b>${otp}</b></p>
        <p>Please provide this OTP at the campus gate.</p>
        <p>Regards,<br/>Aditya University</p>`;
      if (appointment.visitorEmail) {
        sendEmail({ to: appointment.visitorEmail, subject, html }).catch(() => {});
      }

      AuditLog.create({ actorId: req.user?._id, action: 'appointment.create.fasttrack', resource: String(appointment._id) }).catch(() => {});

      return res.status(201).json({
        id: appointment._id,
        status: appointment.status,
        success: true,
      });
    }

    AuditLog.create({ actorId: req.user?._id, action: 'appointment.create', resource: String(appointment._id) }).catch(() => {});
    return res.status(201).json({ id: appointment._id, status: appointment.status, success: true });
  } catch (err) {
    next(err);
  }
};


