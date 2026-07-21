import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../utils/httpClient";
import { StripeService } from "./stripe.service";

describe(StripeService.name, () => {
  describe("getCustomerTransactions", () => {
    it("unwraps the API data envelope so transactions reach the caller", async () => {
      const payload = {
        transactions: [{ id: "ch_123", amount: 2000 }],
        hasMore: false,
        nextPage: null,
        prevPage: null
      };
      const { service } = setup({ payload });

      const result = await service.getCustomerTransactions();

      expect(result).toEqual(payload);
      expect(result.transactions).toHaveLength(1);
    });

    it("throws when startDate is not before endDate", async () => {
      const { service } = setup();

      await expect(service.getCustomerTransactions({ startDate: new Date("2026-07-21T00:00:00Z"), endDate: new Date("2026-06-21T00:00:00Z") })).rejects.toThrow(
        "startDate must be less than endDate"
      );
    });
  });

  function setup(input?: { payload?: unknown }) {
    const payload = input?.payload ?? { transactions: [], hasMore: false, nextPage: null, prevPage: null };
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: { data: payload } })
    } as unknown as HttpClient & { get: ReturnType<typeof vi.fn> };
    const service = new StripeService(httpClient);
    return { service, httpClient };
  }
});
