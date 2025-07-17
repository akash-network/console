import type { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { mock } from "jest-mock-extended";

import {
  usePaymentDiscountsQuery,
  usePaymentMethodsQuery,
  usePaymentMutations,
  usePaymentTransactionsQuery,
  useSetupIntentMutation
} from "./usePaymentQueries";

import { act, waitFor } from "@testing-library/react";
import {
  createMockCouponResponse,
  createMockDiscount,
  createMockItems,
  createMockPaymentMethod,
  createMockPaymentResponse,
  createMockRemovedPaymentMethod,
  createMockSetupIntent,
  createMockTransaction
} from "@tests/seeders/payment";
import { setupQuery } from "@tests/unit/query-client";

describe("usePaymentQueries", () => {
  it("fetches payment methods", async () => {
    const mockMethods = createMockItems(createMockPaymentMethod, 2);
    const stripeService = mock<StripeService>({
      getPaymentMethods: jest.fn().mockResolvedValue(mockMethods)
    });
    const { result } = setupQuery(() => usePaymentMethodsQuery(), {
      services: { stripe: () => stripeService }
    });
    await waitFor(() => {
      expect(stripeService.getPaymentMethods).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockMethods);
    });
  });

  it("fetches payment discounts", async () => {
    const mockDiscounts = {
      discounts: createMockItems(createMockDiscount, 2)
    };
    const stripeService = mock<StripeService>({
      getCustomerDiscounts: jest.fn().mockResolvedValue(mockDiscounts)
    });
    const { result } = setupQuery(() => usePaymentDiscountsQuery(), {
      services: { stripe: () => stripeService }
    });
    await waitFor(() => {
      expect(stripeService.getCustomerDiscounts).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockDiscounts.discounts);
    });
  });

  it("fallbacks to an empty array if 'discounts' field is not present", async () => {
    const stripeService = mock<StripeService>({
      getCustomerDiscounts: jest.fn().mockResolvedValue({})
    });
    const { result } = setupQuery(() => usePaymentDiscountsQuery(), {
      services: { stripe: () => stripeService }
    });
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("fetches payment transactions", async () => {
    const mockTransactions = {
      transactions: createMockItems(createMockTransaction, 2)
    };
    const stripeService = mock<StripeService>({
      getCustomerTransactions: jest.fn().mockResolvedValue(mockTransactions)
    });
    const { result } = setupQuery(() => usePaymentTransactionsQuery({ limit: 2 }), {
      services: { stripe: () => stripeService }
    });
    await waitFor(() => {
      expect(stripeService.getCustomerTransactions).toHaveBeenCalledWith({ limit: 2 });
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.transactions).toEqual(mockTransactions.transactions);
    });
  });

  it("creates setup intent", async () => {
    const mockSetupIntent = createMockSetupIntent();
    const stripeService = mock<StripeService>({
      createSetupIntent: jest.fn().mockResolvedValue(mockSetupIntent)
    });
    const { result } = setupQuery(() => useSetupIntentMutation(), {
      services: { stripe: () => stripeService }
    });
    await act(async () => result.current.mutateAsync());
    await waitFor(() => {
      expect(stripeService.createSetupIntent).toHaveBeenCalled();
    });
  });

  describe("usePaymentMutations", () => {
    it("confirms payment and invalidate queries", async () => {
      const mockPaymentResponse = createMockPaymentResponse();
      const stripeService = mock<StripeService>({
        confirmPayment: jest.fn().mockResolvedValue(mockPaymentResponse)
      });
      const { result } = setupQuery(() => usePaymentMutations(), {
        services: { stripe: () => stripeService }
      });

      await act(async () => {
        await result.current.confirmPayment.mutateAsync({
          userId: "u1",
          paymentMethodId: mockPaymentResponse.id,
          amount: mockPaymentResponse.amount,
          currency: mockPaymentResponse.currency
        });
      });

      await waitFor(() => {
        expect(stripeService.confirmPayment).toHaveBeenCalled();
      });
    });

    it("applies coupon and invalidate discounts", async () => {
      const mockCouponResponse = createMockCouponResponse();
      const stripeService = mock<StripeService>({
        applyCoupon: jest.fn().mockResolvedValue(mockCouponResponse)
      });
      const { result } = setupQuery(() => usePaymentMutations(), {
        services: { stripe: () => stripeService }
      });

      await act(async () => {
        await result.current.applyCoupon.mutateAsync({ coupon: mockCouponResponse.coupon.id, userId: "u1" });
      });

      await waitFor(() => {
        expect(stripeService.applyCoupon).toHaveBeenCalledWith(mockCouponResponse.coupon.id, "u1");
      });
    });

    it("handles coupon application error response", async () => {
      const mockErrorResponse = {
        coupon: null,
        error: {
          message: "No valid promotion code or coupon found with the provided code"
        }
      };
      const stripeService = mock<StripeService>({
        applyCoupon: jest.fn().mockResolvedValue(mockErrorResponse)
      });
      const { result } = setupQuery(() => usePaymentMutations(), {
        services: { stripe: () => stripeService }
      });

      const response = await act(async () => result.current.applyCoupon.mutateAsync({ coupon: "INVALID", userId: "u1" }));
      expect(response.error?.message).toBe("No valid promotion code or coupon found with the provided code");

      await waitFor(() => {
        expect(stripeService.applyCoupon).toHaveBeenCalledWith("INVALID", "u1");
      });
    });

    it("removes payment method and invalidate methods", async () => {
      const mockRemovedPaymentMethod = createMockRemovedPaymentMethod();
      const stripeService = mock<StripeService>({
        removePaymentMethod: jest.fn().mockResolvedValue(mockRemovedPaymentMethod)
      });
      const { result } = setupQuery(() => usePaymentMutations(), {
        services: { stripe: () => stripeService }
      });

      await act(async () => {
        await result.current.removePaymentMethod.mutateAsync(mockRemovedPaymentMethod.id);
      });

      await waitFor(() => {
        expect(stripeService.removePaymentMethod).toHaveBeenCalledWith(mockRemovedPaymentMethod.id);
      });
    });
  });
});
