export type LogContext = 'API' | 'Worker' | 'Database' | 'Redis' | 'App' | 'SMTP' | 'RateLimit';

export const logger = {
  info: (context: LogContext, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [INFO] [${context}] ${message}${metaStr}`);
  },

  warn: (context: LogContext, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.warn(`[${timestamp}] [WARN] [${context}] ${message}${metaStr}`);
  },

  error: (context: LogContext, message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const errStr = error instanceof Error ? error.stack || error.message : error ? ` ${JSON.stringify(error)}` : '';
    console.error(`[${timestamp}] [ERROR] [${context}] ${message}${errStr}`);
  }
};
