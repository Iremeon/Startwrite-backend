import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import * as adminService from './admin.service';

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, meta } = await adminService.listUsers(req.query as Record<string, string>);
    return res.status(200).json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.body;
    const user = await adminService.updateUserStatus(req.params.id, isActive);
    return ResponseService({
      data: user,
      status: 200,
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats();
    return ResponseService({ data: stats, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};
