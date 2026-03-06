// Application logger with labels for consistent log structure

import { LOG_LABEL } from '../constants/log-label.constants';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogPayload {
  label: string;
  msg: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, payload: LogPayload): void {
  const timestamp = new Date().toISOString();
  const { label, msg, ...rest } = payload;
  const logEntry = {
    [LOG_LABEL.TIMESTAMP]: timestamp,
    [LOG_LABEL.LEVEL]: level,
    [LOG_LABEL.LABEL]: label,
    [LOG_LABEL.MESSAGE]: msg,
    ...(Object.keys(rest).length > 0 ? { [LOG_LABEL.PAYLOAD]: rest } : {}),
  };
  const output = JSON.stringify(logEntry);
  console[level](output);
}

export const appLogger = {
  error(payload: LogPayload): void {
    formatLog('error', payload);
  },
  warn(payload: LogPayload): void {
    formatLog('warn', payload);
  },
  info(payload: LogPayload): void {
    formatLog('info', payload);
  },
  debug(payload: LogPayload): void {
    formatLog('debug', payload);
  },
};
