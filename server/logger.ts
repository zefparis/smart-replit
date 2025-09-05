// <AI:BEGIN minimal-logger>
interface LogContext {
  [key: string]: any;
}

class SimpleLogger {
  info(context: LogContext | string, message?: string) {
    if (typeof context === 'string') {
      console.log(`[INFO] ${context}`);
    } else {
      console.log(`[INFO] ${message || 'Log'}`, JSON.stringify(context));
    }
  }

  error(context: LogContext | string, message?: string) {
    if (typeof context === 'string') {
      console.error(`[ERROR] ${context}`);
    } else {
      console.error(`[ERROR] ${message || 'Error'}`, JSON.stringify(context));
    }
  }

  warn(context: LogContext | string, message?: string) {
    if (typeof context === 'string') {
      console.warn(`[WARN] ${context}`);
    } else {
      console.warn(`[WARN] ${message || 'Warning'}`, JSON.stringify(context));
    }
  }
}

export const log = new SimpleLogger();
// <AI:END minimal-logger>