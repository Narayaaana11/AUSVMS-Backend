const mongoose = require('mongoose');

const AttendeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const AppointmentSchema = new mongoose.Schema(
  {
    visitorName: { type: String, required: true, trim: true },
    visitorEmail: { type: String, required: true, lowercase: true, trim: true },
    visitorPhone: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    personToMeet: { type: String, required: true, trim: true }, // staffId or "Admission Office"
    status: { type: String, enum: ['pending', 'approved', 'denied', 'completed'], default: 'pending' },
    attendees: { type: [AttendeeSchema], default: [] },
    otpRef: { type: mongoose.Schema.Types.ObjectId, ref: 'OTP' },
  },
  { timestamps: true }
);

AppointmentSchema.index({ createdAt: -1 });
AppointmentSchema.index({ personToMeet: 1, status: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);


