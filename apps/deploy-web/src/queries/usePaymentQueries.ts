import type { ApplyCouponParams, ConfirmPaymentParams, Discount, PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export const usePaymentMethodsQuery = () => {
  const { stripe } = useServices();
  return useQuery<PaymentMethod[]>({
    queryKey: QueryKeys.getPaymentMethodsKey(),
    queryFn: async () => {
      const response = await stripe.getPaymentMethods();
      return response;
    }
  });
};

export const usePaymentDiscountsQuery = () => {
  const { stripe } = useServices();
  return useQuery<Discount[]>({
    queryKey: QueryKeys.getPaymentDiscountsKey(),
    queryFn: async () => {
      const response = await stripe.getCustomerDiscounts();
      return response.discounts ?? [];
    }
  });
};

export interface UsePaymentTransactionsOptions {
  limit?: number;
  startingAfter?: string;
}

export const usePaymentTransactionsQuery = (options?: UsePaymentTransactionsOptions) => {
  const { stripe } = useServices();
  return useQuery({
    queryKey: QueryKeys.getPaymentTransactionsKey(options),
    queryFn: async () => {
      const response = await stripe.getCustomerTransactions(options);
      return response.transactions;
    }
  });
};

export const useSetupIntentMutation = () => {
  const { stripe } = useServices();
  return useMutation<SetupIntentResponse, Error>({
    mutationFn: async () => {
      const response = await stripe.createSetupIntent();
      return response;
    }
  });
};

export const usePaymentMutations = () => {
  const { stripe } = useServices();
  const queryClient = useQueryClient();

  const confirmPayment = useMutation({
    mutationFn: async ({ userId, paymentMethodId, amount, currency }: ConfirmPaymentParams) => {
      await stripe.confirmPayment({
        userId,
        paymentMethodId,
        amount,
        currency
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful payment
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentDiscountsKey() });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentTransactionsKey() });
    }
  });

  const applyCoupon = useMutation({
    mutationFn: async ({ coupon, userId }: ApplyCouponParams) => {
      const response = await stripe.applyCoupon(coupon, userId);
      return response;
    },
    onSuccess: () => {
      // Invalidate discounts after applying coupon
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentDiscountsKey() });
    }
  });

  const removePaymentMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await stripe.removePaymentMethod(paymentMethodId);
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
