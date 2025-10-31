const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/auvms';
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, { autoIndex: true });
  logger.info('MongoDB Connected');
}

module.exports = { connectDB };


