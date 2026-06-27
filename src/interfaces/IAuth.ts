export interface IRegisterUser {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  tinNumber?: string; // presence = organization (skips email verification)
}

export interface ILoginUser {
  email: string;
  password: string;
}

export interface IGoogleLogin {
  idToken: string;
}

export interface IRefreshToken {
  refreshToken: string;
}

export interface IVerifyEmail {
  token: string;
}

export interface IForgotPassword {
  email: string;
}

export interface IVerifyResetToken {
  token: string;
}

export interface IResetPassword {
  token: string;
  newPassword: string;
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  walletBalance: number | string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}
