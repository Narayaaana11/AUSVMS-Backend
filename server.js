require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const otpRoutes = require('./routes/otpRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', limiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/test', testRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    // Seed default users if not present
    (async () => {
      try {
        const defaults = [
          { username: 'admin1', name: 'Admin User', email: 'admin1@example.com', password: 'admin@123', role: 'admin' },
          { username: 'staff1', name: 'Staff User', email: 'staff1@example.com', password: 'staff@123', role: 'staff' },
          { username: 'guard1', name: 'Guard User', email: 'guard1@example.com', password: 'guard@123', role: 'guard' },
        ];
        for (const userData of defaults) {
          const exists = await User.findOne({ $or: [{ username: userData.username }, { email: userData.email }] });
          if (!exists) {
            await User.create(userData);
            logger.info(`Seeded user: ${userData.username}`);
          }
        }
      } catch (e) {
        logger.error('Seeding users failed', { error: e.message });
      }
    })();
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });

 
