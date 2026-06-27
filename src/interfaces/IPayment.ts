export interface ICheckoutSession {
  planId: string;
}

export interface CheckoutSessionDto {
  checkoutUrl: string | null;
}

export interface PlanDto {
  id: string;
  name: string;
  billingInterval: 'monthly' | 'annual';
  price: string | number;
  currency: string;
}
