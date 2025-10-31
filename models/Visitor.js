const mongoose = require('mongoose');

const VisitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    purposeOfVisit: { type: String, required: true },
    personToMeet: { type: String, required: true },
    photoUrl: { type: String },
    visitorPassId: { type: String, unique: true },
    status: { type: String, enum: ['created', 'checked-in', 'checked-out'], default: 'created' },
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    otpRef: { type: mongoose.Schema.Types.ObjectId, ref: 'OTP' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Visitor', VisitorSchema);


