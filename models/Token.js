const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Token', TokenSchema);


