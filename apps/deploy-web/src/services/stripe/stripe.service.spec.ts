import { loadStripe } from "@stripe/stripe-js";

import { StripeService } from "./stripe.service";

jest.mock("@stripe/stripe-js", () => ({
  loadStripe: jest.fn()
}));

jest.mock("@src/config/browser-env.config", () => ({
  browserEnvConfig: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_mock_key"
  }
}));

describe("StripeService", () => {
  let stripeService: StripeService;
  const mockLoadStripe = loadStripe as jest.MockedFunction<typeof loadStripe>;

  beforeEach(() => {
    stripeService = new StripeService();
    jest.clearAllMocks();
  });

  describe("getStripe", () => {
    it("should load Stripe instance when publishable key is configured", async () => {
      const mockStripeInstance = { mock: "stripe" };
      mockLoadStripe.mockResolvedValue(mockStripeInstance as any);

      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledWith("pk_test_mock_key");
      expect(result).toBe(mockStripeInstance);
    });

    it("should return cached instance on subsequent calls", async () => {
      const mockStripeInstance = { mock: "stripe" };
      mockLoadStripe.mockResolvedValue(mockStripeInstance as any);

      // First call
      await stripeService.getStripe();
      // Second call
      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockStripeInstance);
    });

    it("should handle loadStripe errors gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockLoadStripe.mockRejectedValue(new Error("Stripe load failed"));

      const result = await stripeService.getStripe();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load Stripe:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe("clearStripeInstance", () => {
    it("should clear the cached Stripe instance", async () => {
      const mockStripeInstance = { mock: "stripe" };
      mockLoadStripe.mockResolvedValue(mockStripeInstance as any);

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
});
