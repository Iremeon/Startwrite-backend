import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../utils/response';
import { verifyToken, AppJwtPayload } from '../utils/helper';

export interface IRequestUser extends Request {
  user?: AppJwtPayload;
  token?: string;
}

// Authentication middleware — verifies the JWT and attaches req.user
export const authMiddleware = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return ResponseService({
        data: { code: 'LOGIN_REQUIRED' },
        status: 401,
        success: false,
        message: 'Authentication token is missing',
        res,
      });
    }

    const user = await verifyToken(token);
    if (!user) {
      return ResponseService({
        data: null,
        status: 401,
        success: false,
        message: 'Invalid authentication token',
        res,
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    const { message, stack } = error as Error;
    return ResponseService({
      data: { message, stack },
      status: 401,
      success: false,
      message: 'Invalid authentication token',
      res,
    });
  }
};

/**
 * Optional auth — for routes like GET /templates/:slug that behave differently
 * for anonymous vs logged-in users but don't require login. Never rejects;
 * just attaches req.user if a valid token is present.
 */
export const optionalAuthMiddleware = async (
  req: IRequestUser,
  _res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const user = await verifyToken(token);
    req.user = user;
    req.token = token;
  } catch {
    // Invalid/expired token on an optional-auth route — treat as anonymous, don't error.
  }
  next();
};
