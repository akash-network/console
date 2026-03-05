import type { Stripe } from "@stripe/stripe-js";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeServiceDependencies } from "./stripe.service";
import { StripeService } from "./stripe.service";

describe("StripeService", () => {
  describe("getStripe", () => {
    it("should load Stripe instance when publishable key is configured", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({
        publishableKey: "pk_test_mock_key"
      });

      mockLoadStripe.mockResolvedValue(mockStripeInstance);

      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledWith("pk_test_mock_key");
      expect(result).toBe(mockStripeInstance);
    });

    it("should return cached instance on subsequent calls", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({
        publishableKey: "pk_test_mock_key"
      });

      mockLoadStripe.mockResolvedValue(mockStripeInstance);

      // First call
      await stripeService.getStripe();
      // Second call
      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockStripeInstance);
    });

    it("should handle loadStripe errors gracefully", async () => {
      const { stripeService, mockLoadStripe } = setup({
        publishableKey: "pk_test_mock_key"
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      mockLoadStripe.mockRejectedValue(new Error("Stripe load failed"));

      const result = await stripeService.getStripe();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load Stripe:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe("clearStripeInstance", () => {
    it("should clear the cached Stripe instance", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({
        publishableKey: "pk_test_mock_key"
      });

      mockLoadStripe.mockResolvedValue(mockStripeInstance);

      // Load instance
      await stripeService.getStripe();
      expect(mockLoadStripe).toHaveBeenCalledTimes(1);

      // Clear instance
      stripeService.clearStripeInstance();

      // Load again
      await stripeService.getStripe();
      expect(mockLoadStripe).toHaveBeenCalledTimes(2);
    });
  });

  function setup(input: { publishableKey: string }) {
    const mockLoadStripe = vi.fn() as MockedFunction<Required<StripeServiceDependencies>["loadStripe"]>;
    const mockStripeInstance = mock<Stripe>();

    const stripeService = new StripeService({
      loadStripe: mockLoadStripe,
      config: {
        publishableKey: input.publishableKey
      }
    });

    return {
      stripeService,
      mockLoadStripe,
      mockStripeInstance
    };
  }
});
