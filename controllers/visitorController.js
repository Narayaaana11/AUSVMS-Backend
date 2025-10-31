const createError = require('http-errors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Visitor = require('../models/Visitor');
const generateVisitorID = require('../utils/generateVisitorID');
const { sendEmail, sendSMS } = require('../utils/notify');

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

exports.upload = multer({ storage });

exports.createVisitor = async (req, res, next) => {
  try {
    const { name, contactNumber, email, purposeOfVisit, personToMeet } = req.body;
    if (!name || !contactNumber || !purposeOfVisit || !personToMeet) {
      return next(createError(400, 'Missing required fields'));
    }
    const visitorPassId = generateVisitorID();
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const visitor = await Visitor.create({
      name,
      contactNumber,
      email,
      purposeOfVisit,
      personToMeet,
      photoUrl,
      visitorPassId,
      createdBy: req.user?._id,
    });
    res.status(201).json(visitor);
  } catch (err) {
    next(err);
  }
};

exports.getVisitor = async (req, res, next) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return next(createError(404, 'Visitor not found'));
    res.json(visitor);
  } catch (err) {
    next(err);
  }
};

exports.listVisitors = async (req, res, next) => {
  try {
    const { name, status, from, to } = req.query;
    const filter = {};
    if (name) filter.name = new RegExp(name, 'i');
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const visitors = await Visitor.find(filter).sort({ createdAt: -1 });
    res.json(visitors);
  } catch (err) {
    next(err);
  }
};

exports.updateVisitor = async (req, res, next) => {
  try {
    const updates = req.body;
    if (req.file) updates.photoUrl = `/uploads/${req.file.filename}`;
    const visitor = await Visitor.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!visitor) return next(createError(404, 'Visitor not found'));
    res.json(visitor);
  } catch (err) {
    next(err);
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return next(createError(404, 'Visitor not found'));
    visitor.status = 'checked-in';
    visitor.checkInAt = new Date();
    await visitor.save();
    // Notifications (best-effort)
    if (visitor.email) {
      sendEmail({
        to: visitor.email,
        subject: 'Visitor Check-In Confirmation',
        html: `<p>Dear ${visitor.name}, you have checked in. Pass: ${visitor.visitorPassId}</p>`,
      }).catch(() => {});
    }
    sendSMS({ to: visitor.contactNumber, message: 'You have checked in to Aditya University.' }).catch(() => {});
    res.json(visitor);
  } catch (err) {
    next(err);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return next(createError(404, 'Visitor not found'));
    visitor.status = 'checked-out';
    visitor.checkOutAt = new Date();
    await visitor.save();
    // Notifications (best-effort)
    if (visitor.email) {
      sendEmail({
        to: visitor.email,
        subject: 'Visitor Check-Out Confirmation',
        html: `<p>Dear ${visitor.name}, you have checked out. Thank you for visiting.</p>`,
      }).catch(() => {});
    }
    sendSMS({ to: visitor.contactNumber, message: 'You have checked out of Aditya University.' }).catch(() => {});
    res.json(visitor);
  } catch (err) {
    next(err);
  }
};


