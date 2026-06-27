export interface ITopUp {
  packageId: string;
}

export interface WalletPackageDto {
  id: string;
  label: string;
  amount: number | string;
}

export interface CheckoutSessionDto {
  checkoutUrl: string | null;
}

export interface WalletTransactionDto {
  id: string;
  type: 'TOP_UP' | 'DOWNLOAD_DEDUCTION';
  amount: number | string;
  balanceAfter: number | string;
  templateId?: string | null;
  createdAt: Date;
}

export interface WalletMeDto {
  balance: number | string;
  transactions: WalletTransactionDto[];
}