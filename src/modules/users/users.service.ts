import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { IUpdateProfile } from '../../interfaces/IUser';

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      tinNumber: true,
      role: true,
      walletBalance: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return user;
};

/**
 * Users can update their own name and phone number.
 * Email changes would require re-verification (not supported here).
 * TIN, role, walletBalance — admin-only or system-managed.
 * Password — handled by the dedicated reset flow.
 */
export const updateMyProfile = async (userId: string, input: IUpdateProfile) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      tinNumber: true,
      role: true,
      walletBalance: true,
      isEmailVerified: true,
      updatedAt: true,
    },
  });
};

/**
 * Admin soft-deletes a user (isActive: false).
 * Hard delete is intentionally avoided — wallet transactions reference the
 * user ID for audit purposes and would break referential integrity.
 * A soft-deleted user cannot log in (403 ACCOUNT_DISABLED) and is hidden
 * from the default admin user list filter.
 */
export const softDeleteUser = async (adminId: string, targetUserId: string) => {
  if (adminId === targetUserId) {
    throw new ApiError(400, 'CANNOT_DELETE_SELF', 'Admins cannot delete their own account.');
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (user.role === 'admin') {
    throw new ApiError(403, 'CANNOT_DELETE_ADMIN', 'Admin accounts cannot be deleted this way.');
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
    select: { id: true, name: true, email: true, isActive: true },
  });
};