const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: { type: String },
    details: { type: Object },
    ip: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);


