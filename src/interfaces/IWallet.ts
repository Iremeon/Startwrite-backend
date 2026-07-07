export interface ITopUp {
  packageId: string;
  phoneNumber: string;
}

export interface IDirectPay {
  phoneNumber: string;
}

export interface WalletPackageDto {
  id: string;
  label: string;
  amount: number | string;
}

export interface PaypackInitiateDto {
  ref: string;
  status: string;
  message: string;
}

export interface WalletTransactionDto {
  id: string;
  type: 'TOP_UP' | 'DOWNLOAD_DEDUCTION';
  amount: number | string;
  balanceAfter: number | string;
  templateId?: string | null;
  paymentRef?: string | null;
  createdAt: Date;
}

export interface WalletMeDto {
  balance: number | string;
  transactions: WalletTransactionDto[];
}

// Stored in Redis when a cashin is initiated — lets the webhook
// know which user/action to process when Paypack calls back.
export interface PaypackRefMeta {
  userId: string;
  type: 'TOP_UP' | 'DIRECT_PURCHASE';
  packageId?: string;
  templateId?: string;
}

// Paypack webhook payload shape
export interface PaypackWebhookPayload {
  event_id: string;
  kind: string;
  created_at: string;
  data: {
    ref: string;
    kind: string;
    fee: number;
    merchant: string;
    client: string;
    amount: number;
    provider: string;
    status: string;
    created_at: string;
    processed_at: string;
  };
}