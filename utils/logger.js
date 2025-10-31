const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'auvms-backend' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${rest}`;
        })
      ),
    }),
  ],
});

module.exports = logger;


