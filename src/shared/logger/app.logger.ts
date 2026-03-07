import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, label, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;
  if (label) msg += ` [${label}]`;
  msg += `: ${message}`;
  if (Object.keys(metadata).length > 0) {
    if (metadata.err && metadata.err instanceof Error) {
      msg += `\n${metadata.err.stack || metadata.err.message}`;
      delete metadata.err;
    }
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
  }
  return msg;
});

// Internal winston instance: Provides basic visibility for startup and critical errors
const internalLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console()
  ],
});

// Application logger exported for the rest of the application
export const appLogger = {
  info: (payload: { msg: string; label?: string;[key: string]: any }) => {
    const { msg, ...meta } = payload;
    internalLogger.info(msg, meta);
  },
  error: (payload: { msg: string; label?: string; err?: any;[key: string]: any }) => {
    const { msg, ...meta } = payload;
    internalLogger.error(msg, meta);
  },
  warn: (payload: { msg: string; label?: string;[key: string]: any }) => {
    const { msg, ...meta } = payload;
    internalLogger.warn(msg, meta);
  },
  debug: (payload: { msg: string; label?: string;[key: string]: any }) => {
    const { msg, ...meta } = payload;
    internalLogger.debug(msg, meta);
  }
};
