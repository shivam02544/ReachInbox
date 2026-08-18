import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('API', `404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
      status: 404
    }
  });
}

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('API', `Unhandled Error [${statusCode}]: ${message}`, err);

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode
    }
  });
}
