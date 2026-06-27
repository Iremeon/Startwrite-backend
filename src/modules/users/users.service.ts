import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';

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
