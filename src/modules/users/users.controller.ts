import { Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import { IRequestUser } from '../../middlewares/authenticate';
import * as usersService from './users.service';

export const getMe = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getCurrentUser(req.user!.id);
    return ResponseService({
      data: user,
      status: 200,
      success: true,
      message: 'Current user profile',
      res,
    });
  } catch (error) {
    next(error);
  }
};
