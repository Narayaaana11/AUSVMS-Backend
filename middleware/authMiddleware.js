const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/User');

async function protect(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(createError(401, 'Not authorized, token missing'));
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(createError(401, 'Not authorized'));
    req.user = user;
    next();
  } catch (err) {
    next(createError(401, 'Not authorized, token invalid'));
  }
}

function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createError(403, 'Forbidden'));
    }
    next();
  };
}

module.exports = { protect, authorizeRoles };


