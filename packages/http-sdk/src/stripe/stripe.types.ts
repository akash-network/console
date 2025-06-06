export interface StripePrice {
  unitAmount?: number;
  isCustom: boolean;
  currency: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface PaymentResponse {
  error?: {
    message: string;
  };
}

export interface Coupon {
  id: string;
  percent_off?: number | null;
  amount_off?: number | null;
  valid: boolean;
  name?: string;
  description?: string;
}

export interface CouponResponse {
  coupon: Coupon;
}

export interface CustomerDiscountsResponse {
  discounts: Array<{
    type: "coupon" | "promotion_code";
    id: string;
    name?: string;
    code?: string;
    percent_off?: number;
    amount_off?: number;
    currency?: string;
    valid: boolean;
  }>;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  description?: string;
  metadata?: Record<string, string>;
}
