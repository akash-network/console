import { ZodType } from "zod";

if (!ZodType.prototype.openapi) {
  ZodType.prototype.openapi = function () {
    return this;
  };
}

import { secondsInDay } from "date-fns/constants";

import { CustomerTransactionsQuerySchema } from "./stripe.schema";

describe("CustomerTransactionsQuerySchema", () => {
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
