export interface IRegisterUser {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  tinNumber?: string;
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

// Code-based verification — user types the 6-digit code from their email.
export interface IVerifyEmail {
  email: string;
  code: string;
}

export interface IForgotPassword {
  email: string;
}

export interface IVerifyResetToken {
  email: string;
  code: string;
}

export interface IResetPassword {
  email: string;
  code: string;
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