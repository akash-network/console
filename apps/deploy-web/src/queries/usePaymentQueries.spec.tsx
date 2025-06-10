import { stripeService } from "@src/services/http/http-browser.service";
import { queryClient } from "./queryClient";
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

jest.mock("@src/services/http/http-browser.service", () => ({
  stripeService: {
    getPaymentMethods: jest.fn(),
    getCustomerDiscounts: jest.fn(),
    getCustomerTransactions: jest.fn(),
    createSetupIntent: jest.fn(),
    confirmPayment: jest.fn(),
    applyCoupon: jest.fn(),
    removePaymentMethod: jest.fn()
  }
}));

describe("usePaymentQueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it("should fetch payment methods", async () => {
    const mockMethods = createMockItems(createMockPaymentMethod, 2);
    (stripeService.getPaymentMethods as jest.Mock).mockResolvedValue(mockMethods);
    const { result } = setupQuery(() => usePaymentMethodsQuery());
    await waitFor(() => {
      expect(stripeService.getPaymentMethods).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockMethods);
    });
  });

  it("should fetch payment discounts", async () => {
    const mockDiscounts = {
      discounts: createMockItems(createMockDiscount, 2)
    };
    (stripeService.getCustomerDiscounts as jest.Mock).mockResolvedValue(mockDiscounts);
    const { result } = setupQuery(() => usePaymentDiscountsQuery());
    await waitFor(() => {
      expect(stripeService.getCustomerDiscounts).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockDiscounts.discounts);
    });
  });

  it("should handle empty discounts response", async () => {
    (stripeService.getCustomerDiscounts as jest.Mock).mockResolvedValue({});
    const { result } = setupQuery(() => usePaymentDiscountsQuery());
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("should fetch payment transactions", async () => {
    const mockTransactions = {
      transactions: createMockItems(createMockTransaction, 2)
    };
    (stripeService.getCustomerTransactions as jest.Mock).mockResolvedValue(mockTransactions);
    const { result } = setupQuery(() => usePaymentTransactionsQuery({ limit: 2 }));
    await waitFor(() => {
      expect(stripeService.getCustomerTransactions).toHaveBeenCalledWith({ limit: 2 });
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockTransactions.transactions);
    });
  });

  it("should create setup intent", async () => {
    const mockSetupIntent = createMockSetupIntent();
    (stripeService.createSetupIntent as jest.Mock).mockResolvedValue(mockSetupIntent);
    const { result } = setupQuery(() => useSetupIntentMutation());
    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => {
      expect(stripeService.createSetupIntent).toHaveBeenCalled();
    });
  });

  describe("usePaymentMutations", () => {
    it("should confirm payment and invalidate queries", async () => {
      const mockPaymentResponse = createMockPaymentResponse();
      (stripeService.confirmPayment as jest.Mock).mockResolvedValue(mockPaymentResponse);
      const { result } = setupQuery(() => usePaymentMutations());

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

    it("should apply coupon and invalidate discounts", async () => {
      const mockCouponResponse = createMockCouponResponse();
      (stripeService.applyCoupon as jest.Mock).mockResolvedValue(mockCouponResponse);
      const { result } = setupQuery(() => usePaymentMutations());

      await act(async () => {
        await result.current.applyCoupon.mutateAsync({ coupon: mockCouponResponse.coupon.id });
      });

      await waitFor(() => {
        expect(stripeService.applyCoupon).toHaveBeenCalledWith(mockCouponResponse.coupon.id);
      });
    });

    it("should remove payment method and invalidate methods", async () => {
      const mockRemovedPaymentMethod = createMockRemovedPaymentMethod();
      (stripeService.removePaymentMethod as jest.Mock).mockResolvedValue(mockRemovedPaymentMethod);
      const { result } = setupQuery(() => usePaymentMutations());

      await act(async () => {
        await result.current.removePaymentMethod.mutateAsync(mockRemovedPaymentMethod.id);
      });

      await waitFor(() => {
        expect(stripeService.removePaymentMethod).toHaveBeenCalledWith(mockRemovedPaymentMethod.id);
      });
    });
  });
});
