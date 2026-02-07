import { secondsInDay } from "date-fns/constants";

import { CustomerTransactionsCsvExportQuerySchema, CustomerTransactionsQuerySchema } from "./stripe.schema";

describe("Stripe Schema", () => {
  describe("CustomerTransactionsQuerySchema", () => {
    it("accepts no dates", () => {
      const out = CustomerTransactionsQuerySchema.parse({});
      expect(out).toEqual({});
    });

    it("accepts only startDate", () => {
      const startDate = new Date();
      const out = CustomerTransactionsQuerySchema.parse({ startDate: startDate.toISOString() });
      expect(out).toEqual({ startDate: startDate.toISOString() });
    });

    it("accepts only endDate", () => {
      const endDate = new Date();
      const out = CustomerTransactionsQuerySchema.parse({ endDate: endDate.toISOString() });
      expect(out).toEqual({ endDate: endDate.toISOString() });
    });

    it("accepts both startDate and endDate when range ≤ 366 days", () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + secondsInDay * 1000 * 366);
      const out = CustomerTransactionsQuerySchema.parse({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      expect(out).toEqual({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    });

    it("rejects when startDate > endDate", () => {
      expect(() =>
        CustomerTransactionsQuerySchema.parse({
          startDate: new Date("2025-01-02T00:00:00Z").toISOString(),
          endDate: new Date("2025-01-01T00:00:00Z").toISOString()
        })
      ).toThrow("Date range cannot exceed 366 days and startDate must be before endDate");
    });

    it("rejects when range > 366 days", () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + secondsInDay * 1000 * 367);
      expect(() =>
        CustomerTransactionsQuerySchema.parse({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      ).toThrow("Date range cannot exceed 366 days and startDate must be before endDate");
    });
  });

  describe("CustomerTransactionsCsvExportQuerySchema", () => {
    it("accepts valid timezone", () => {
      const out = CustomerTransactionsCsvExportQuerySchema.parse({
        timezone: "America/New_York",
        startDate: "2023-01-01T00:00:00Z",
        endDate: "2023-01-02T00:00:00Z"
      });
      expect(out).toEqual({ timezone: "America/New_York", startDate: "2023-01-01T00:00:00Z", endDate: "2023-01-02T00:00:00Z" });
    });

    it("rejects missing timezone", () => {
      expect(() => CustomerTransactionsCsvExportQuerySchema.parse({})).toThrow("Required");
    });

    it("rejects invalid timezone", () => {
      expect(() => CustomerTransactionsCsvExportQuerySchema.parse({ timezone: "Invalid/Timezone" })).toThrow("Invalid IANA timezone");
    });
  });
});
