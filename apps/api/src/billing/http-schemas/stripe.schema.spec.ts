import { ZodType } from "zod";

if (!ZodType.prototype.openapi) {
  ZodType.prototype.openapi = function () {
    return this;
  };
}

import { CustomerTransactionsQuerySchema } from "./stripe.schema";

describe("CustomerTransactionsQuerySchema", () => {
  const ONE_DAY_SECONDS = 24 * 60 * 60;

  it("accepts no parameters and returns only an empty created object", () => {
    const { schema } = setup();
    const out = schema.parse({});
    expect(out).toEqual({ created: {} });
  });

  it("carries through startingAfter and endingBefore with empty created", () => {
    const { schema } = setup();
    const input = {
      startingAfter: "ch_after",
      endingBefore: "ch_before"
    };
    const out = schema.parse(input);
    expect(out).toEqual({
      startingAfter: "ch_after",
      endingBefore: "ch_before",
      created: {}
    });
  });

  it("parses only created[gt] into created.gt", () => {
    const { schema } = setup();
    const gt = 1_600_000_000;
    const out = schema.parse({
      "created[gt]": gt
    });
    expect(out.created).toEqual({ gt });
    expect(out["created[gt]"]).toBe(gt);
  });

  it("parses only created[lt] into created.lt", () => {
    const { schema } = setup();
    const lt = 1_700_000_000;
    const out = schema.parse({
      "created[lt]": lt
    });
    expect(out.created).toEqual({ lt });
    expect(out["created[lt]"]).toBe(lt);
  });

  it("accepts both created[gt] and created[lt] when range ≤ 366 days", () => {
    const { schema } = setup();
    const gt = ONE_DAY_SECONDS;
    const lt = gt + ONE_DAY_SECONDS * 366;
    const out = schema.parse({
      "created[gt]": gt,
      "created[lt]": lt
    });
    expect(out.created).toEqual({ gt, lt });
  });

  it("rejects when created[gt] > created[lt]", () => {
    const { schema } = setup();
    expect(() =>
      schema.parse({
        "created[gt]": 2_000,
        "created[lt]": 1_000
      })
    ).toThrow("Date range cannot exceed 366 days and startDate must be before endDate");
  });

  it("rejects when range > 366 days", () => {
    const { schema } = setup();
    const gt = ONE_DAY_SECONDS;
    const lt = gt + ONE_DAY_SECONDS * 367;
    expect(() =>
      schema.parse({
        "created[gt]": gt,
        "created[lt]": lt
      })
    ).toThrow("Date range cannot exceed 366 days and startDate must be before endDate");
  });

  function setup() {
    return {
      schema: CustomerTransactionsQuerySchema
    };
  }
});
