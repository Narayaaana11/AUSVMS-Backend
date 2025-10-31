const createError = require('http-errors');
const dayjs = require('dayjs');
const Visitor = require('../models/Visitor');
const User = require('../models/User');
const { createObjectCsvStringifier } = require('csv-writer');
const ExcelJS = require('exceljs');

exports.getStats = async (_req, res, next) => {
  try {
    const [totalUsers, totalStaff, totalGuards] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: { $in: ['admin', 'visitor'] } }), // Using available roles; adjust if more roles are added
      User.countDocuments({ role: 'security' }),
    ]);

    const startOfDay = dayjs().startOf('day').toDate();
    const endOfDay = dayjs().endOf('day').toDate();

    const [todayVisitors, pendingApprovals, checkedIn, checkedOut] = await Promise.all([
      Visitor.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Visitor.countDocuments({ status: 'created' }),
      Visitor.countDocuments({ status: 'checked-in' }),
      Visitor.countDocuments({ status: 'checked-out' }),
    ]);

    res.json({
      totals: {
        users: totalUsers,
        staff: totalStaff,
        guards: totalGuards,
      },
      visitors: {
        today: todayVisitors,
        pendingApprovals,
        checkedIn,
        checkedOut,
      },
    });
  } catch (err) {
    next(err);
  }
};

function buildVisitorLogFilter(query) {
  const { from, to, status, q } = query;
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { contactNumber: new RegExp(q, 'i') },
      { personToMeet: new RegExp(q, 'i') },
      { visitorPassId: q },
    ];
  }
  return filter;
}

exports.getVisitorLogs = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 25 } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 200);
    const filter = buildVisitorLogFilter(req.query);

    const [items, total] = await Promise.all([
      Visitor.find(filter)
        .sort({ createdAt: -1 })
        .skip((numericPage - 1) * numericPageSize)
        .limit(numericPageSize),
      Visitor.countDocuments(filter),
    ]);

    res.json({ items, total, page: numericPage, pageSize: numericPageSize });
  } catch (err) {
    next(err);
  }
};

exports.exportVisitorLogs = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const filter = buildVisitorLogFilter(req.query);
    const items = await Visitor.find(filter).sort({ createdAt: -1 });

    const rows = items.map((v) => ({
      Name: v.name,
      Email: v.email || '',
      Phone: v.contactNumber,
      Purpose: v.purposeOfVisit,
      PersonToMeet: v.personToMeet,
      VisitorPassId: v.visitorPassId,
      Status: v.status,
      CheckInAt: v.checkInAt ? dayjs(v.checkInAt).toISOString() : '',
      CheckOutAt: v.checkOutAt ? dayjs(v.checkOutAt).toISOString() : '',
      CreatedAt: dayjs(v.createdAt).toISOString(),
    }));

    if (format === 'xlsx' || format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Visitor Logs');
      sheet.columns = Object.keys(rows[0] || { A: '' }).map((key) => ({ header: key, key }));
      sheet.addRows(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="visitor_logs.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    // default CSV
    const headers = Object.keys(rows[0] || { Name: '', Phone: '' }).map((id) => ({ id, title: id }));
    const csvStringifier = createObjectCsvStringifier({ header: headers });
    const headerRow = csvStringifier.getHeaderString();
    const bodyRows = csvStringifier.stringifyRecords(rows);
    const csv = headerRow + bodyRows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visitor_logs.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};


