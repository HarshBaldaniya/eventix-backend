// Log labels for structured logging. Prefix: LOG_LABEL_

export const LOG_LABEL_REQUEST = 'request';
export const LOG_LABEL_RESPONSE = 'response';
export const LOG_LABEL_ERROR = 'error';
export const LOG_LABEL_ERROR_HANDLER = 'error_handler';
export const LOG_LABEL_DB = 'database';
export const LOG_LABEL_SECURITY = 'security';
export const LOG_LABEL_MIDDLEWARE = 'middleware';
export const LOG_LABEL_SERVICE = 'service';
export const LOG_LABEL_REPOSITORY = 'repository';
export const LOG_LABEL_CONTROLLER = 'controller';
export const LOG_LABEL_APPLICATION = 'application';
export const LOG_LABEL_PRESENTATION = 'presentation';
export const LOG_LABEL_INFRASTRUCTURE = 'infrastructure';
export const LOG_LABEL_APP_START = 'app_start';
export const LOG_LABEL_APP_SHUTDOWN = 'app_shutdown';
export const LOG_LABEL_TIMESTAMP = 'timestamp';
export const LOG_LABEL_LEVEL = 'level';
export const LOG_LABEL_LABEL = 'label';
export const LOG_LABEL_MESSAGE = 'message';
export const LOG_LABEL_PAYLOAD = 'payload';

export const LOG_LABEL = {
  REQUEST: LOG_LABEL_REQUEST,
  RESPONSE: LOG_LABEL_RESPONSE,
  ERROR: LOG_LABEL_ERROR,
  ERROR_HANDLER: LOG_LABEL_ERROR_HANDLER,
  DB: LOG_LABEL_DB,
  SECURITY: LOG_LABEL_SECURITY,
  MIDDLEWARE: LOG_LABEL_MIDDLEWARE,
  SERVICE: LOG_LABEL_SERVICE,
  REPOSITORY: LOG_LABEL_REPOSITORY,
  CONTROLLER: LOG_LABEL_CONTROLLER,
  APPLICATION: LOG_LABEL_APPLICATION,
  PRESENTATION: LOG_LABEL_PRESENTATION,
  INFRASTRUCTURE: LOG_LABEL_INFRASTRUCTURE,
  APP_START: LOG_LABEL_APP_START,
  APP_SHUTDOWN: LOG_LABEL_APP_SHUTDOWN,
  TIMESTAMP: LOG_LABEL_TIMESTAMP,
  LEVEL: LOG_LABEL_LEVEL,
  LABEL: LOG_LABEL_LABEL,
  MESSAGE: LOG_LABEL_MESSAGE,
  PAYLOAD: LOG_LABEL_PAYLOAD,
} as const;
