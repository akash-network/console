import type {
  ApplyCouponParams,
  ConfirmPaymentParams,
  ConfirmPaymentResponse,
  PaymentMethod,
  SetupIntentResponse,
  ThreeDSecureAuthParams
} from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export const usePaymentMethodsQuery = (options?: Omit<UseQueryOptions<PaymentMethod[]>, "queryKey" | "queryFn">) => {
  const { stripe } = useServices();
  return useQuery<PaymentMethod[]>({
    ...options,
    queryKey: QueryKeys.getPaymentMethodsKey(),
    queryFn: async () => {
      const response = await stripe.getPaymentMethods();
      return response;
    }
  });
};

export interface UsePaymentTransactionsOptions {
  limit?: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export const usePaymentTransactionsQuery = (options?: UsePaymentTransactionsOptions) => {
  const { stripe } = useServices();
  return useQuery({
    queryKey: QueryKeys.getPaymentTransactionsKey(options),
    queryFn: async () => {
      return await stripe.getCustomerTransactions(options);
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
    mutationFn: async ({ userId, paymentMethodId, amount, currency }: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> => {
      return await stripe.confirmPayment({
        userId,
        paymentMethodId,
        amount,
        currency
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful payment
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentTransactionsKey() });
    }
  });

  const validatePaymentMethodAfter3DS = useMutation({
    mutationFn: async ({ paymentMethodId, paymentIntentId }: ThreeDSecureAuthParams) => {
      return await stripe.validatePaymentMethodAfter3DS({
        paymentMethodId,
        paymentIntentId
      });
    },
    onSuccess: () => {
      // Invalidate payment methods after 3DS validation
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
    }
  });

  const applyCoupon = useMutation({
    mutationFn: async ({ coupon, userId }: ApplyCouponParams) => {
      const response = await stripe.applyCoupon(coupon, userId);
      return response;
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

  const setPaymentMethodAsDefault = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await stripe.setPaymentMethodAsDefault({ id: paymentMethodId });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
    }
  });

  return {
    confirmPayment,
    validatePaymentMethodAfter3DS,
    applyCoupon,
    removePaymentMethod,
    setPaymentMethodAsDefault
  };
};
