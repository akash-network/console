import { useCallback } from "react";
import type { paths } from "@akashnetwork/console-api-types";
import type {
  ApplyCouponParams,
  ConfirmPaymentParams,
  ConfirmPaymentResponse,
  PaymentMethod,
  SetupIntentResponse,
  ThreeDSecureAuthParams
} from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { walletProvisioningRetry } from "@src/utils/walletProvisioning";
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
    catchError(error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    },
    select: response => response?.data ?? null
  });
};

type ListStripeTransactionsResponse = paths["/v1/stripe/transactions"]["get"]["responses"][200]["content"]["application/json"];

export type BillingTransaction = ListStripeTransactionsResponse["data"]["transactions"][number];

export interface UsePaymentTransactionsOptions {
  limit?: number;
  offset?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export const usePaymentTransactionsQuery = ({ limit, offset, startDate, endDate }: UsePaymentTransactionsOptions = {}) => {
  const { api } = useServices();
  return api.v1.listStripeTransactions.useQuery(
    {
      limit,
      offset: offset ?? undefined,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    },
    { select: response => response.data, placeholderData: keepPreviousData }
  );
};

export const useSetupIntentMutation = () => {
  const { stripe, errorHandler } = useServices();
  return useMutation<SetupIntentResponse, Error>({
    retry: false,
    mutationFn: async () => {
      const response = await stripe.createSetupIntent();
      return response;
    },
    onError: error => {
      errorHandler.reportError({ error, tags: { category: "billing" } });
    }
  });
};

/**
 * Refreshes the payment-methods list, then the default-payment-method query. The order is load
 * bearing: the awaited list refetch resolves only after the server-side read-repair in
 * getPaymentMethods has committed, so the following default fetch observes the healed state rather
 * than the stale drift it was about to repair.
 */
export const useRefreshPaymentMethods = () => {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
    await queryClient.invalidateQueries({ queryKey: api.v1.getDefaultPaymentMethod.getKey() });
  }, [api, queryClient]);
};

export const usePaymentMutations = () => {
  const { stripe, api } = useServices();
  const queryClient = useQueryClient();
  const refreshPaymentMethods = useRefreshPaymentMethods();

  const confirmPayment = useMutation({
    ...walletProvisioningRetry,
    mutationFn: async ({ userId, paymentMethodId, amount, idempotencyKey }: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> => {
      return await stripe.confirmPayment({
        userId,
        paymentMethodId,
        amount,
        idempotencyKey
      });
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: api.v1.listStripeTransactions.getKey() });

      if (!response.requiresAction) {
        refreshPaymentMethods();
      }
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
      refreshPaymentMethods();
    }
  });

  const applyCoupon = useMutation({
    ...walletProvisioningRetry,
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
      refreshPaymentMethods();
      queryClient.invalidateQueries({ queryKey: api.v1.getWalletSettings.getKey() });
    }
  });

  const setPaymentMethodAsDefault = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await stripe.setPaymentMethodAsDefault({ id: paymentMethodId });
      return response;
    },
    onSuccess: () => {
      refreshPaymentMethods();
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
