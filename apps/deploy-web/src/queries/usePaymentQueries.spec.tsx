import { useServices } from "@src/context/ServicesProvider";
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

jest.mock("@src/context/ServicesProvider");

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
    (useServices as jest.Mock).mockReturnValue({
      stripe: {
        getPaymentMethods: jest.fn(),
        getCustomerDiscounts: jest.fn(),
        getCustomerTransactions: jest.fn(),
        createSetupIntent: jest.fn(),
        confirmPayment: jest.fn(),
        applyCoupon: jest.fn(),
        removePaymentMethod: jest.fn()
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it("should fetch payment methods", async () => {
    const mockMethods = createMockItems(createMockPaymentMethod, 2);
    (useServices().stripe.getPaymentMethods as jest.Mock).mockResolvedValue(mockMethods);
    const { result } = setupQuery(() => usePaymentMethodsQuery());
    await waitFor(() => {
      expect(useServices().stripe.getPaymentMethods).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockMethods);
    });
  });

  it("should fetch payment discounts", async () => {
    const mockDiscounts = {
      discounts: createMockItems(createMockDiscount, 2)
    };
    (useServices().stripe.getCustomerDiscounts as jest.Mock).mockResolvedValue(mockDiscounts);
    const { result } = setupQuery(() => usePaymentDiscountsQuery());
    await waitFor(() => {
      expect(useServices().stripe.getCustomerDiscounts).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockDiscounts.discounts);
    });
  });

  it("should handle empty discounts response", async () => {
    (useServices().stripe.getCustomerDiscounts as jest.Mock).mockResolvedValue({});
    const { result } = setupQuery(() => usePaymentDiscountsQuery());
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("should fetch payment transactions", async () => {
    const mockTransactions = {
      transactions: createMockItems(createMockTransaction, 2)
    };
    (useServices().stripe.getCustomerTransactions as jest.Mock).mockResolvedValue(mockTransactions);
    const { result } = setupQuery(() => usePaymentTransactionsQuery({ limit: 2 }));
    await waitFor(() => {
      expect(useServices().stripe.getCustomerTransactions).toHaveBeenCalledWith({ limit: 2 });
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockTransactions.transactions);
    });
  });

  it("should create setup intent", async () => {
    const mockSetupIntent = createMockSetupIntent();
    (useServices().stripe.createSetupIntent as jest.Mock).mockResolvedValue(mockSetupIntent);
    const { result } = setupQuery(() => useSetupIntentMutation());
    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => {
      expect(useServices().stripe.createSetupIntent).toHaveBeenCalled();
    });
  });

  describe("usePaymentMutations", () => {
    it("should confirm payment and invalidate queries", async () => {
      const mockPaymentResponse = createMockPaymentResponse();
      (useServices().stripe.confirmPayment as jest.Mock).mockResolvedValue(mockPaymentResponse);
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
        expect(useServices().stripe.confirmPayment).toHaveBeenCalled();
      });
    });

    it("should apply coupon and invalidate discounts", async () => {
      const mockCouponResponse = createMockCouponResponse();
      (useServices().stripe.applyCoupon as jest.Mock).mockResolvedValue(mockCouponResponse);
      const { result } = setupQuery(() => usePaymentMutations());

      await act(async () => {
        await result.current.applyCoupon.mutateAsync({ coupon: mockCouponResponse.coupon.id });
      });

      await waitFor(() => {
        expect(useServices().stripe.applyCoupon).toHaveBeenCalledWith(mockCouponResponse.coupon.id);
      });
    });

    it("should handle coupon application error response", async () => {
      const mockErrorResponse = {
        coupon: null,
        error: {
          message: "No valid promotion code or coupon found with the provided code"
        }
      };
      (useServices().stripe.applyCoupon as jest.Mock).mockResolvedValue(mockErrorResponse);
      const { result } = setupQuery(() => usePaymentMutations());

      const response = await act(async () => result.current.applyCoupon.mutateAsync({ coupon: "INVALID" }));
      expect(response.error?.message).toBe("No valid promotion code or coupon found with the provided code");

      await waitFor(() => {
        expect(useServices().stripe.applyCoupon).toHaveBeenCalledWith("INVALID");
      });
    });

    it("should remove payment method and invalidate methods", async () => {
      const mockRemovedPaymentMethod = createMockRemovedPaymentMethod();
      (useServices().stripe.removePaymentMethod as jest.Mock).mockResolvedValue(mockRemovedPaymentMethod);
      const { result } = setupQuery(() => usePaymentMutations());

      await act(async () => {
        await result.current.removePaymentMethod.mutateAsync(mockRemovedPaymentMethod.id);
      });

      await waitFor(() => {
        expect(useServices().stripe.removePaymentMethod).toHaveBeenCalledWith(mockRemovedPaymentMethod.id);
      });
    });
  });
});
