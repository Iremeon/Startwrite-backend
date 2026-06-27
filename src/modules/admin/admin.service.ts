import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination';
import { IListUsersQuery } from '../../interfaces/IAdmin';

export const listUsers = async (filters: IListUsersQuery) => {
  const { page, limit, skip } = getPaginationParams(filters);

  const where: Record<string, unknown> = {};
  if (filters.role) where.role = filters.role;
  if (filters.isActive !== undefined)
    where.isActive = filters.isActive === 'true' || filters.isActive === true;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        tinNumber: true,
        role: true,
        walletBalance: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, meta: buildPaginationMeta(page, limit, total) };
};

export const updateUserStatus = async (id: string, isActive: boolean) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return prisma.user.update({ where: { id }, data: { isActive } });
};

export const getDashboardStats = async () => {
  const [
    totalUsers,
    organizationCount,
    totalTemplates,
    totalDownloads,
    totalTopUps,
    walletBalanceSum,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { tinNumber: { not: null } } }),
    prisma.template.count({ where: { isActive: true } }),
    prisma.template.aggregate({ _sum: { downloadCount: true } }),
    prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { type: 'TOP_UP' },
    }),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
  ]);

  const popularTemplates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { downloadCount: 'desc' },
    take: 5,
    select: { id: true, title: true, downloadCount: true, templateClass: true },
  });

  return {
    totalUsers,
    organizationCount,
    individualCount: totalUsers - organizationCount,
    totalTemplates,
    totalDownloads: totalDownloads._sum.downloadCount || 0,
    totalRevenue: totalTopUps._sum.amount || 0,
    totalOutstandingWalletBalance: walletBalanceSum._sum.walletBalance || 0,
    popularTemplates,
  };
};
