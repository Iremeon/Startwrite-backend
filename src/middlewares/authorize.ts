import { Response, NextFunction } from 'express';
import { ResponseService } from '../utils/response';
import { IRequestUser } from './authenticate';

/**
 * Checks the user's role against an allowed list.
 *
 * Note: the role is already embedded in the JWT payload (see
 * src/utils/helper.ts -> AppJwtPayload), and the schema only has two roles
 * (`user`, `admin`) as a plain enum on `users` — there's no separate Roles
 * table. So this is a direct string comparison, not a DB lookup. Keeping it
 * this way avoids an extra query on every protected admin request.
 */
export const checkRole =
  (roles: Array<'user' | 'admin'>) => (req: IRequestUser, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return ResponseService({
        data: null,
        status: 403,
        success: false,
        message: 'Role information is missing',
        res,
      });
    }

    if (!roles.includes(req.user.role)) {
      return ResponseService({
        data: null,
        status: 403,
        success: false,
        message: 'You do not have the required role to perform this action',
        res,
      });
    }

    next();
  };

// Convenience shorthand for the common case
export const requireAdmin = checkRole(['admin']);
