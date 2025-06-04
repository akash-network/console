export interface PaymentMethod {
  id: string;
  created: number;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export interface Discount {
  id: string;
  type: "coupon" | "promotion_code";
  valid: boolean;
  percent_off?: number;
  amount_off?: number;
  currency?: string;
  code?: string;
  name?: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface ConfirmPaymentParams {
  paymentMethodId: string;
  amount: number;
  currency: string;
  coupon?: string;
}

export interface ApplyCouponParams {
  coupon: string;
}
