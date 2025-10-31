const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const dayjs = require('dayjs');
const User = require('../models/User');
const Token = require('../models/Token');

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d',
  });
}

function signRefreshToken(user) {
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRE || '7d';
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn,
  });
}

exports.register = async (req, res, next) => {
  try {
    const { username, name, email, password, role } = req.body;
    if (!username || !name || !email || !password) return next(createError(400, 'Missing fields'));
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return next(createError(409, 'User already exists'));
    const user = await User.create({ username, name, email, password, role: role || 'security' });
    res.status(201).json({ id: user._id, username: user.username, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return next(createError(401, 'Invalid credentials'));
    const match = await user.comparePassword(password);
    if (!match) return next(createError(401, 'Invalid credentials'));
    if (user.isActive === false) return next(createError(403, 'Account disabled'));
    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Persist refresh token with expiry and not revoked
    const decoded = jwt.decode(refreshToken);
    const expiresAt = decoded && decoded.exp ? dayjs.unix(decoded.exp).toDate() : dayjs().add(7, 'day').toDate();
    await Token.create({ user: user._id, token: refreshToken, expiresAt, revoked: false });

    // Set HttpOnly cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/api/auth',
    });

    res.json({
      token,
      user: { username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies && req.cookies.refreshToken;
    const tokenToRevoke = refreshToken || cookieToken;
    if (tokenToRevoke) await Token.updateOne({ token: tokenToRevoke }, { $set: { revoked: true } });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.profile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    if (!refreshToken) return next(createError(401, 'Refresh token missing'));

    // Validate token signature and expiry
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (_e) {
      return next(createError(401, 'Invalid refresh token'));
    }

    // Ensure token record exists and not revoked
    const tokenDoc = await Token.findOne({ token: refreshToken, revoked: false });
    if (!tokenDoc) return next(createError(401, 'Refresh token revoked'));

    const user = await User.findById(payload.id);
    if (!user || user.isActive === false) return next(createError(401, 'User not authorized'));

    const newAccessToken = signAccessToken(user);
    res.json({ token: newAccessToken });
  } catch (err) {
    next(err);
  }
};


