export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  tinNumber?: string | null;
  role: 'user' | 'admin';
  walletBalance: number | string;
  isEmailVerified: boolean;
  createdAt: Date;
}

export interface IUpdateProfile {
  name?: string;
  phoneNumber?: string | null;
}