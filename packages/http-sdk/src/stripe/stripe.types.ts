export interface StripePrice {
  unitAmount?: number;
  isCustom: boolean;
  currency: string;
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
  validated: boolean;
  isDefault?: boolean;
  card?: {
    brand: string;
    last4: string;
    funding: "credit" | "debit" | "prepaid" | "unknown";
    exp_month: number;
    exp_year: number;
  };
  link?: {
    email?: string | null;
  } | null;
}

export type BillingTransactionType = "payment_intent" | "coupon_claim" | "manual_credit";

export interface BillingTransaction {
  id: string;
  type: BillingTransactionType;
  amount: number;
  /** Cumulative amount refunded on this transaction, in cents. */
  amountRefunded: number;
  /** First-purchase bonus credited with this payment, in cents. */
  bonusAmount?: number;
  currency: string;
  status: string;
  created: number;
  cardBrand?: string | null;
  cardLast4?: string | null;
  stripeInvoiceId?: string | null;
  receiptUrl?: string | null;
  description?: string | null;
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
  /** Client attempt key (uuid): retries of the same attempt reuse it so the API charges at most once. */
  idempotencyKey?: string;
}

export interface ApplyCouponParams {
  coupon: string;
  userId: string;
}

export interface CustomerTransactionsParams {
  limit?: number;
  offset?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface CustomerTransactionsResponse {
  transactions: BillingTransaction[];
  totalCount: number;
  hasMore: boolean;
}

export interface ExportTransactionsCsvParams {
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  transactionId?: string;
  /** "succeeded" on a replayed attempt means the wallet was already credited by the first delivery. */
  transactionStatus?: string;
}

export interface ThreeDSecureAuthParams {
  paymentMethodId: string;
  paymentIntentId: string;
}

export interface SetPaymentMethodAsDefaultParams {
  id: string;
}
