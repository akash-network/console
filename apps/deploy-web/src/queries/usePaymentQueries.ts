import type { ApplyCouponParams, ConfirmPaymentParams, Discount, PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { stripeService } from "@src/services/http/http-browser.service";
import { QueryKeys } from "./queryKeys";

export const usePaymentMethodsQuery = () => {
  return useQuery<PaymentMethod[]>({
    queryKey: QueryKeys.getPaymentMethodsKey(),
    queryFn: async () => {
      const response = await stripeService.getPaymentMethods();
      return response;
    }
  });
};

export const usePaymentDiscountsQuery = () => {
  return useQuery<Discount[]>({
    queryKey: QueryKeys.getPaymentDiscountsKey(),
    queryFn: async () => {
      const response = await stripeService.getCustomerDiscounts();
      return response.discounts ?? [];
    }
  });
};

export interface UsePaymentTransactionsOptions {
  limit?: number;
  startingAfter?: string;
}

export const usePaymentTransactionsQuery = (options?: UsePaymentTransactionsOptions) => {
  return useQuery({
    queryKey: QueryKeys.getPaymentTransactionsKey(options),
    queryFn: async () => {
      const response = await stripeService.getCustomerTransactions(options);
      return response.transactions;
    }
  });
};

export const useSetupIntentMutation = () => {
  return useMutation<SetupIntentResponse, Error>({
    mutationFn: async () => {
      const response = await stripeService.createSetupIntent();
      return response;
    }
  });
};

export const usePaymentMutations = () => {
  const queryClient = useQueryClient();

  const confirmPayment = useMutation({
    mutationFn: async ({ userId, paymentMethodId, amount, currency, coupon }: ConfirmPaymentParams) => {
      const response = await stripeService.confirmPayment({
        userId,
        paymentMethodId,
        amount,
        currency,
        ...(coupon && { coupon })
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful payment
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentDiscountsKey() });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentTransactionsKey() });
    }
  });

  const applyCoupon = useMutation({
    mutationFn: async ({ coupon }: ApplyCouponParams) => {
      const response = await stripeService.applyCoupon(coupon);
      return response;
    },
    onSuccess: () => {
      // Invalidate discounts after applying coupon
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentDiscountsKey() });
    }
  });

  const removePaymentMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await stripeService.removePaymentMethod(paymentMethodId);
      return response;
    },
    onSuccess: () => {
      // Invalidate payment methods after removal
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
    }
  });

  return {
    confirmPayment,
    applyCoupon,
    removePaymentMethod
  };
};
