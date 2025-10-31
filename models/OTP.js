const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true }, // can reference Visitor or Appointment
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

OTPSchema.index({ appointmentId: 1, used: 1 });

module.exports = mongoose.model('OTP', OTPSchema);


