const createError = require('http-errors');
const User = require('../models/User');

exports.createUser = async (req, res, next) => {
  try {
    const { username, name, email, password, role, department, designation } = req.body;
    if (!username || !name || !email || !password || !role) {
      return next(createError(400, 'Missing required fields'));
    }
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return next(createError(409, 'User already exists'));
    const user = await User.create({ username, name, email, password, role, department, designation });
    res.status(201).json({ id: user._id, username: user.username, name: user.name, email: user.email, role: user.role, department: user.department, designation: user.designation });
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const {
      q,
      role,
      department,
      status, // 'active' | 'disabled'
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (q) {
      const regex = new RegExp(String(q), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { username: regex },
        { role: regex },
        { department: regex },
        { designation: regex },
      ];
    }
    if (role && role !== 'all') filter.role = role;
    if (department && department !== 'all') filter.department = department;
    if (status && (status === 'active' || status === 'disabled')) filter.isActive = status === 'active';

    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedSize = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 10));
    const skip = (parsedPage - 1) * parsedSize;

    const sort = { [String(sortBy)]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      User.find(filter).select('-password').sort(sort).skip(skip).limit(parsedSize),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page: parsedPage, pageSize: parsedSize });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return next(createError(404, 'User not found'));
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, designation, isActive } = req.body;
    const update = { name, email, role, department, designation, isActive };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).select('-password');
    if (!user) return next(createError(404, 'User not found'));
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.toggleActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return next(createError(404, 'User not found'));
    user.isActive = !user.isActive;
    await user.save();
    res.json({ id: user._id, isActive: user.isActive });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) return next(createError(400, 'New password too short'));
    const user = await User.findById(id);
    if (!user) return next(createError(404, 'User not found'));
    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};


// Public: list staff/guards/admins for appointment booking or selection
exports.listStaffPublic = async (_req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: ['admin', 'staff', 'guard', 'security'] }, isActive: true })
      .select('_id name email role department designation');
    res.json(staff);
  } catch (err) {
    next(err);
  }
};


