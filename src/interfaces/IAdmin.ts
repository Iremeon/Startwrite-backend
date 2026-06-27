export interface IListUsersQuery {
  role?: 'user' | 'admin';
  isActive?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface IUpdateUserStatus {
  isActive: boolean;
}

export interface DashboardStatsDto {
  totalUsers: number;
  organizationCount: number;
  individualCount: number;
  totalTemplates: number;
  totalDownloads: number;
  totalRevenue: number | string;
  totalOutstandingWalletBalance: number | string;
  popularTemplates: Array<{
    id: string;
    title: string;
    downloadCount: number;
    templateClass: string;
  }>;
}
