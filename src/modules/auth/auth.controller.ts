import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import { IRequestUser } from '../../middlewares/authenticate';
import * as authService from './auth.service';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.registerUser(req.body);
    return ResponseService({
      data: user,
      status: 201,
      success: true,
      message: 'Registration successful. A 6-digit verification code has been sent to your email.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);
    return ResponseService({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          walletBalance: user.walletBalance,
        },
      },
      status: 200,
      success: true,
      message: 'Login successful',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginOrRegisterWithGoogle(idToken);
    return ResponseService({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          walletBalance: user.walletBalance,
        },
      },
      status: 200,
      success: true,
      message: 'Login successful',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshAccessToken(refreshToken);
    return ResponseService({ data: tokens, status: 200, success: true, message: 'Token refreshed', res });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    await authService.logoutUser(req.user!.id, refreshToken);
    return ResponseService({ data: null, status: 200, success: true, message: 'Logged out successfully', res });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    await authService.verifyEmail(email, code);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Email verified successfully. You can now log in.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    await authService.resendVerificationCode(email);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'A new verification code has been sent to your email.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'If an account exists for this email, a 6-digit reset code has been sent.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyResetCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    await authService.verifyResetCode(email, code);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Code is valid. You can now set a new password.',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, newPassword } = req.body;
    await authService.resetPassword(email, code, newPassword);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Password reset successfully. You can now log in.',
      res,
    });
  } catch (error) {
    next(error);
  }
};