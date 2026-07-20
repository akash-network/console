import type { paths } from "@akashnetwork/console-api-types";
import type {
  ApplyCouponParams,
  ConfirmPaymentParams,
  ConfirmPaymentResponse,
  CustomerTransactionsResponse,
  PaymentMethod,
  SetupIntentResponse,
  ThreeDSecureAuthParams
} from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
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

type DefaultPaymentMethodResponse = paths["/v1/stripe/payment-methods/default"]["get"]["responses"][200]["content"]["application/json"];

export const useDefaultPaymentMethodQuery = (
  options?: Omit<UseQueryOptions<DefaultPaymentMethodResponse>, "queryKey" | "queryFn" | "select">
): UseQueryResult<DefaultPaymentMethodResponse["data"] | null> => {
  const { api } = useServices();
  return api.v1.getDefaultPaymentMethod.useQuery(undefined, {
    ...options,
    select: response => response?.data ?? null,
    catchError(error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
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

export const usePaymentTransactionsQuery = (
  options?: UsePaymentTransactionsOptions,
  queryOptions?: Omit<UseQueryOptions<CustomerTransactionsResponse>, "queryKey" | "queryFn">
) => {
  const { stripe } = useServices();
  return useQuery({
    ...queryOptions,
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
  const { stripe, api } = useServices();
  const queryClient = useQueryClient();

  const confirmPayment = useMutation({
    mutationFn: async ({ userId, paymentMethodId, amount }: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> => {
      return await stripe.confirmPayment({
        userId,
        paymentMethodId,
        amount
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
      queryClient.invalidateQueries({ queryKey: api.v1.getDefaultPaymentMethod.getKey() });
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
