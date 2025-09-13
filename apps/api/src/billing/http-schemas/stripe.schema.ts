import { differenceInDays } from "date-fns";
import { z } from "zod";

export const SetupIntentResponseSchema = z.object({
  data: z.object({
    clientSecret: z.string().nullable()
  })
});

export const PaymentMethodSchema = z.object({
  type: z.string(),
  validated: z.boolean().optional(),
  card: z
    .object({
      brand: z.string().nullable(),
      last4: z.string().nullable(),
      exp_month: z.number(),
      exp_year: z.number(),
      funding: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      network: z.string().nullable().optional(),
      three_d_secure_usage: z
        .object({
          supported: z.boolean().nullable().optional()
        })
        .nullable()
        .optional()
    })
    .nullable()
    .optional(),
  billing_details: z
    .object({
      address: z
        .object({
          city: z.string().nullable(),
          country: z.string().nullable(),
          line1: z.string().nullable(),
          line2: z.string().nullable(),
          postal_code: z.string().nullable(),
          state: z.string().nullable()
        })
        .nullable()
        .optional(),
      email: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional()
    })
    .optional()
});

export const PaymentMethodsResponseSchema = z.object({
  data: z.array(PaymentMethodSchema)
});

export const ConfirmPaymentRequestSchema = z.object({
  data: z.object({
    userId: z.string(),
    paymentMethodId: z.string(),
    amount: z.number(),
    currency: z.string()
  })
});

export const PaymentIntentResultSchema = z.object({
  success: z.boolean(),
  requiresAction: z.boolean().optional(),
  clientSecret: z.string().optional(),
  paymentIntentId: z.string().optional()
});

export const PaymentMethodValidationResultSchema = z.object({
  success: z.boolean(),
  requires3DS: z.boolean().optional(),
  clientSecret: z.string().optional(),
  paymentIntentId: z.string().optional(),
  paymentMethodId: z.string().optional()
});

export const ConfirmPaymentResponseSchema = z.object({
  data: PaymentIntentResultSchema
});

export const ApplyCouponRequestSchema = z.object({
  data: z.object({
    couponId: z.string(),
    userId: z.string()
  })
});

export const CouponSchema = z.object({
  id: z.string(),
  percent_off: z.number().nullable().optional(),
  amount_off: z.number().nullable().optional(),
  valid: z.boolean().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

export const ApplyCouponResponseSchema = z.object({
  data: z.object({
    coupon: CouponSchema.nullable().optional(),
    amountAdded: z.number().optional(),
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
        type: z.string().optional()
      })
      .optional()
  })
});

export const DiscountSchema = z.object({
  type: z.enum(["coupon", "promotion_code"]),
  id: z.string(),
  coupon_id: z.string().optional(),
  name: z.string().nullable().optional(),
  code: z.string().optional(),
  percent_off: z.number().nullable().optional(),
  amount_off: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  valid: z.boolean()
});

export const CustomerDiscountsResponseSchema = z.object({
  data: z.object({
    discounts: z.array(DiscountSchema)
  })
});

export const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  created: z.number(),
  paymentMethod: PaymentMethodSchema.nullable(),
  receiptUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string()).nullable().optional()
});

export const CustomerTransactionsResponseSchema = z.object({
  data: z.object({
    transactions: z.array(TransactionSchema),
    hasMore: z.boolean(),
    nextPage: z.string().nullable().optional()
  })
});

const dateRangeSchema = {
  startDate: z.string().datetime().openapi({
    description: "Start date for filtering transactions (inclusive)",
    example: "2025-01-01T00:00:00Z"
  }),
  endDate: z.string().datetime().openapi({
    description: "End date for filtering transactions (inclusive)",
    example: "2025-01-02T00:00:00Z"
  })
};

const dateRangeCheck = (data: { startDate?: string; endDate?: string }) => {
  if (!data.startDate || !data.endDate) {
    return true;
  }

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  return start <= end && differenceInDays(end, start) <= 366;
};

const dateRangeErrorMessage = "Date range cannot exceed 366 days and startDate must be before endDate";

export const CustomerTransactionsQuerySchema = z
  .object({
    limit: z.coerce.number().optional().openapi({
      type: "number",
      minimum: 1,
      maximum: 100,
      description: "Number of transactions to return",
      example: 100,
      default: 100
    }),
    startingAfter: z.string().optional().openapi({
      description: "ID of the last transaction from the previous page (if paginating forwards)",
      example: "ch_1234567890"
    }),
    endingBefore: z.string().optional().openapi({
      description: "ID of the first transaction from the previous page (if paginating backwards)",
      example: "ch_0987654321"
    }),
    startDate: dateRangeSchema.startDate.optional(),
    endDate: dateRangeSchema.endDate.optional()
  })
  .refine(dateRangeCheck, {
    message: dateRangeErrorMessage
  });

export const CustomerTransactionsCsvExportQuerySchema = z
  .object({
    timezone: z
      .string()
      .refine(tz => Intl.supportedValuesOf("timeZone").includes(tz), { message: "Invalid IANA timezone" })
      .openapi({
        description: "Timezone for date formatting in the CSV",
        example: "America/New_York"
      }),
    ...dateRangeSchema
  })
  .refine(dateRangeCheck, {
    message: dateRangeErrorMessage
  });

export const MarkPaymentMethodValidatedRequestSchema = z.object({
  data: z.object({
    paymentMethodId: z.string().openapi({}),
    paymentIntentId: z.string().openapi({})
  })
});

export const MarkPaymentMethodValidatedResponseSchema = z.object({
  success: z.boolean()
});

export const ErrorResponseSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  type: z.string().optional()
});

export type SetupIntentResponse = z.infer<typeof SetupIntentResponseSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentMethodsResponse = z.infer<typeof PaymentMethodsResponseSchema>;
export type ConfirmPaymentRequest = z.infer<typeof ConfirmPaymentRequestSchema>;
export type PaymentIntentResult = z.infer<typeof PaymentIntentResultSchema>;
export type PaymentMethodValidationResult = z.infer<typeof PaymentMethodValidationResultSchema>;
export type ConfirmPaymentResponse = z.infer<typeof ConfirmPaymentResponseSchema>;
export type ApplyCouponRequest = z.infer<typeof ApplyCouponRequestSchema>;
export type Coupon = z.infer<typeof CouponSchema>;
export type ApplyCouponResponse = z.infer<typeof ApplyCouponResponseSchema>;
export type Discount = z.infer<typeof DiscountSchema>;
export type CustomerDiscountsResponse = z.infer<typeof CustomerDiscountsResponseSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type CustomerTransactionsResponse = z.infer<typeof CustomerTransactionsResponseSchema>;
export type CustomerTransactionsQuery = z.infer<typeof CustomerTransactionsQuerySchema>;
export type MarkPaymentMethodValidatedRequest = z.infer<typeof MarkPaymentMethodValidatedRequestSchema>;
export type MarkPaymentMethodValidatedResponse = z.infer<typeof MarkPaymentMethodValidatedResponseSchema>;
