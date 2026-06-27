import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { ResponseService } from '../utils/response';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return ResponseService({
      data: { code: err.code, ...(err.details ? { details: err.details } : {}) },
      status: err.status,
      success: false,
      message: err.message,
      res,
    });
  }

  // Malformed JSON bodies (e.g. bad control characters, broken syntax) are a
  // client error, not a server failure — body-parser throws these with a
  // status/statusCode already attached. Surface that instead of a generic 500.
  const errWithStatus = err as ErrorWithStatus;
  if (errWithStatus.type === 'entity.parse.failed' || errWithStatus.status === 400) {
    return ResponseService({
      data: { code: 'MALFORMED_REQUEST_BODY' },
      status: 400,
      success: false,
      message:
        'Request body is not valid JSON. Check for stray characters, unescaped quotes, or broken formatting.',
      res,
    });
  }

  console.error('Unhandled error:', err);
  return ResponseService({
    data: null,
    status: 500,
    success: false,
    message: 'Internal server error',
    res,
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  return ResponseService({
    data: null,
    status: 404,
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    res,
  });
};
