import type { Stripe } from "@stripe/stripe-js";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeServiceDependencies } from "./stripe.service";
import { StripeService } from "./stripe.service";

describe("StripeService", () => {
  describe("getStripe", () => {
    it("loads Stripe with its sandbox assistant turned off when publishable key is configured", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({
        publishableKey: "pk_test_mock_key"
      });

      mockLoadStripe.mockResolvedValue(mockStripeInstance);

      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledWith("pk_test_mock_key", { developerTools: { assistant: { enabled: false } } });
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

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockLoadStripe.mockRejectedValue(new Error("Stripe load failed"));

      const result = await stripeService.getStripe();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load Stripe:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it("loads Stripe again after a failed load", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({
        publishableKey: "pk_test_mock_key"
      });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockLoadStripe.mockRejectedValueOnce(new Error("Stripe load failed")).mockResolvedValue(mockStripeInstance);

      await stripeService.getStripe();
      const result = await stripeService.getStripe();

      expect(mockLoadStripe).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockStripeInstance);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("load", () => {
    it("shares one Stripe load between callers that ask while it is in flight", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({ publishableKey: "pk_test_mock_key" });
      mockLoadStripe.mockResolvedValue(mockStripeInstance);

      const [first, second] = await Promise.all([stripeService.load(), stripeService.getStripe()]);

      expect(mockLoadStripe).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ stripe: mockStripeInstance });
      expect(second).toBe(mockStripeInstance);
    });

    it("reports the script as failed when the browser cannot load Stripe.js", async () => {
      const { stripeService, mockLoadStripe } = setup({ publishableKey: "pk_test_mock_key" });
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockLoadStripe.mockRejectedValue(new Error("Failed to load Stripe.js"));

      expect(await stripeService.load()).toEqual({ stripe: null, failure: "script_failed" });
    });

    it("reports the script as failed when Stripe.js loads as nothing", async () => {
      const { stripeService, mockLoadStripe } = setup({ publishableKey: "pk_test_mock_key" });
      mockLoadStripe.mockResolvedValue(null);

      expect(await stripeService.load()).toEqual({ stripe: null, failure: "script_failed" });
    });

    it("reports Stripe as unconfigured without loading it when there is no publishable key", async () => {
      const { stripeService, mockLoadStripe } = setup({ publishableKey: "" });
      vi.spyOn(console, "warn").mockImplementation(() => undefined);

      expect(await stripeService.load()).toEqual({ stripe: null, failure: "unconfigured" });
      expect(mockLoadStripe).not.toHaveBeenCalled();
    });

    it("keeps a newer load when an older one that was cleared fails", async () => {
      const { stripeService, mockLoadStripe, mockStripeInstance } = setup({ publishableKey: "pk_test_mock_key" });
      const firstLoad = Promise.withResolvers<null>();
      mockLoadStripe.mockReturnValueOnce(firstLoad.promise).mockResolvedValue(mockStripeInstance);

      const first = stripeService.load();
      stripeService.clearStripeInstance();
      await stripeService.load();
      firstLoad.resolve(null);
      await first;
      await stripeService.load();

      expect(mockLoadStripe).toHaveBeenCalledTimes(2);
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
