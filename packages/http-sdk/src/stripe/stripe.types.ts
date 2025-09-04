export interface StripePrice {
  unitAmount?: number;
  isCustom: boolean;
  currency: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
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
  coupon: Coupon | null;
  amountAdded?: number;
  error?: {
    message: string;
    code?: string;
    type?: string;
  };
}

export interface CustomerDiscountsResponse {
  discounts: Array<Discount>;
}

export interface PaymentMethod {
  id: string;
  type: string;
  created: number;
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
  userId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
}

export interface ApplyCouponParams {
  coupon: string;
  userId: string;
}

export interface CustomerTransactionsParams {
  limit?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface CustomerTransactionsResponse {
  transactions: Charge[];
  hasMore: boolean;
  nextPage: string | null;
  prevPage: string | null;
  totalCount: number;
}

export interface ExportTransactionsCsvParams {
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface TestChargeParams {
  userId: string;
  paymentMethodId: string;
}
