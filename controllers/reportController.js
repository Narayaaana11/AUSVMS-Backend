const createError = require('http-errors');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const Visitor = require('../models/Visitor');

exports.dailyReport = async (_req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const total = await Visitor.countDocuments({ createdAt: { $gte: start, $lte: end } });
    const checkedIn = await Visitor.countDocuments({ status: 'checked-in', createdAt: { $gte: start, $lte: end } });
    const checkedOut = await Visitor.countDocuments({ status: 'checked-out', createdAt: { $gte: start, $lte: end } });
    res.json({ date: start.toISOString().slice(0, 10), total, checkedIn, checkedOut });
  } catch (err) {
    next(err);
  }
};

exports.monthlyReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = month ? parseInt(month, 10) - 1 : now.getMonth();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const grouped = await Visitor.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          checkedIn: { $sum: { $cond: [{ $eq: ['$status', 'checked-in'] }, 1, 0] } },
          checkedOut: { $sum: { $cond: [{ $eq: ['$status', 'checked-out'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(grouped.map((g) => ({ date: g._id, total: g.total, checkedIn: g.checkedIn, checkedOut: g.checkedOut })));
  } catch (err) {
    next(err);
  }
};

exports.exportLogs = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const logs = await Visitor.find().sort({ createdAt: -1 }).lean();

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Visitors');
      sheet.columns = [
        { header: 'Visitor Pass ID', key: 'visitorPassId', width: 22 },
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Contact', key: 'contactNumber', width: 16 },
        { header: 'Email', key: 'email', width: 22 },
        { header: 'Purpose', key: 'purposeOfVisit', width: 24 },
        { header: 'Person To Meet', key: 'personToMeet', width: 22 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Check In', key: 'checkInAt', width: 24 },
        { header: 'Check Out', key: 'checkOutAt', width: 24 },
        { header: 'Created At', key: 'createdAt', width: 24 },
      ];
      sheet.addRows(
        logs.map((l) => ({
          ...l,
          checkInAt: l.checkInAt ? new Date(l.checkInAt).toISOString() : '',
          checkOutAt: l.checkOutAt ? new Date(l.checkOutAt).toISOString() : '',
          createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : '',
        }))
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="visitor_logs.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    const exportDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const filePath = path.join(exportDir, `visitor_logs_${Date.now()}.csv`);
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'visitorPassId', title: 'Visitor Pass ID' },
        { id: 'name', title: 'Name' },
        { id: 'contactNumber', title: 'Contact' },
        { id: 'email', title: 'Email' },
        { id: 'purposeOfVisit', title: 'Purpose' },
        { id: 'personToMeet', title: 'Person To Meet' },
        { id: 'status', title: 'Status' },
        { id: 'checkInAt', title: 'Check In' },
        { id: 'checkOutAt', title: 'Check Out' },
        { id: 'createdAt', title: 'Created At' },
      ],
    });

    await csvWriter.writeRecords(
      logs.map((l) => ({
        ...l,
        checkInAt: l.checkInAt ? new Date(l.checkInAt).toISOString() : '',
        checkOutAt: l.checkOutAt ? new Date(l.checkOutAt).toISOString() : '',
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : '',
      }))
    );
    res.download(filePath);
  } catch (err) {
    next(err);
  }
};


