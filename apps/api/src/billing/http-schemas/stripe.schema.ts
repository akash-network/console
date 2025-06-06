import { z } from "zod";

export const SetupIntentResponseSchema = z.object({
  clientSecret: z.string()
});

export const PaymentMethodSchema = z.object({
  id: z.string(),
  card: z.object({
    brand: z.string(),
    last4: z.string(),
    exp_month: z.number(),
    exp_year: z.number()
  }),
  created: z.number()
});

export const PaymentMethodsResponseSchema = z.object({
  data: z.array(PaymentMethodSchema)
});

export const ConfirmPaymentRequestSchema = z.object({
  paymentMethodId: z.string(),
  amount: z.number(),
  currency: z.string(),
  coupon: z.string().optional()
});

export const ConfirmPaymentResponseSchema = z.object({
  error: z
    .object({
      message: z.string()
    })
    .optional()
});

export const ApplyCouponRequestSchema = z.object({
  couponId: z.string()
});

export const CouponSchema = z.object({
  id: z.string(),
  percent_off: z.number().nullable().optional(),
  amount_off: z.number().nullable().optional(),
  valid: z.boolean(),
  name: z.string().optional(),
  description: z.string().optional()
});

export const ApplyCouponResponseSchema = z.object({
  coupon: z.any()
});

export const DiscountSchema = z.object({
  type: z.enum(["coupon", "promotion_code"]),
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  percent_off: z.number().optional(),
  amount_off: z.number().optional(),
  currency: z.string().optional(),
  valid: z.boolean()
});

export const CustomerDiscountsResponseSchema = z.object({
  discounts: z.array(DiscountSchema)
});

export const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  created: z.number(),
  paymentMethod: z.any(),
  receiptUrl: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional()
});

export const CustomerTransactionsResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  hasMore: z.boolean(),
  nextPage: z.string().optional()
});

export const CustomerTransactionsQuerySchema = z.object({
  limit: z.string().optional().openapi({
    type: "number",
    minimum: 1,
    maximum: 100,
    description: "Number of transactions to return",
    example: "100",
    default: "100"
  }),
  startingAfter: z.string().optional().openapi({
    description: "ID of the last transaction from the previous page",
    example: "ch_1234567890"
  })
});
