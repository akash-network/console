import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../utils/httpClient";
import { StripeService } from "./stripe.service";

describe(StripeService.name, () => {
  describe("getCustomerTransactions", () => {
    it("unwraps the API data envelope so transactions reach the caller", async () => {
      const payload = {
        transactions: [{ id: "txn_123", type: "payment_intent", amount: 2000, amountRefunded: 0 }],
        totalCount: 1,
        hasMore: false
      };
      const { service } = setup({ payload });

      const result = await service.getCustomerTransactions();

      expect(result).toEqual(payload);
      expect(result.transactions).toHaveLength(1);
    });

    it("forwards limit and offset as query params", async () => {
      const { service, httpClient } = setup();

      await service.getCustomerTransactions({ limit: 10, offset: 20 });

      expect(httpClient.get).toHaveBeenCalledWith("/v1/stripe/transactions?limit=10&offset=20");
    });

    it("throws when startDate is after endDate", async () => {
      const { service } = setup();

      await expect(service.getCustomerTransactions({ startDate: new Date("2026-07-21T00:00:00Z"), endDate: new Date("2026-06-21T00:00:00Z") })).rejects.toThrow(
        "startDate must be less than endDate"
      );
    });

    it("throws when startDate equals endDate", async () => {
      const { service } = setup();
      const sameInstant = new Date("2026-07-21T00:00:00Z");

      await expect(service.getCustomerTransactions({ startDate: sameInstant, endDate: sameInstant })).rejects.toThrow("startDate must be less than endDate");
    });
  });

  describe("downloadTransactionInvoice", () => {
    it("posts for the invoice of the transaction and returns the PDF as a blob", async () => {
      const pdf = new Blob(["%PDF"], { type: "application/pdf" });
      const { service, httpClient } = setup({ pdf });

      const result = await service.downloadTransactionInvoice("tx-1");

      expect(httpClient.post).toHaveBeenCalledWith("/v1/stripe/transactions/tx-1/invoice", undefined, { responseType: "blob" });
      expect(result).toBe(pdf);
    });
  });

  function setup(input?: { payload?: unknown; pdf?: Blob }) {
    const payload = input?.payload ?? { transactions: [], totalCount: 0, hasMore: false };
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: { data: payload } }),
      post: vi.fn().mockResolvedValue({ data: input?.pdf })
    } as unknown as HttpClient & { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    const service = new StripeService(httpClient);
    return { service, httpClient };
  }
});
