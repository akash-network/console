import type { Context, Next } from "hono";
import { isHttpError } from "http-errors";
import { mock } from "jest-mock-extended";

import { ChainErrorMiddleware } from "./chain-error.middleware";

describe(ChainErrorMiddleware.name, () => {
  it("passes through when no error is thrown", async () => {
    const { intercept, next, context } = setup();
    await intercept(context, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 400 for insufficient funds error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("insufficient funds: 10uakt is smaller than 20uakt"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400, message: "insufficient funds: 10uakt is smaller than 20uakt" });
  });

  it("returns 400 for deposit too low error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("Deposit too low: minimum is 5000000uakt"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for deployment closed error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("Deployment closed"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid coin denominations error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("invalid coin denominations"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid gpu attributes error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("invalid gpu attributes"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid deployment version error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("invalid: deployment version"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid deployment hash error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(
      new Error("Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Invalid: deployment hash")
    );

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for fee allowance expired error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("fee allowance expired"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for deployment exists error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("Deployment exists"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid owner address error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("Invalid Owner Address: invalid address"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for bid not open error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("bid not open"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for order not open error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("order not open"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 400 });
  });

  it("returns 402 for insufficient balance error", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("insufficient balance"));

    await expect(intercept(context, next)).rejects.toMatchObject({ status: 402 });
  });

  it("preserves original error message", async () => {
    const { intercept, next, context } = setup();
    const originalMessage =
      "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 1: Deposit invalid: insufficient balance";
    next.mockRejectedValue(new Error(originalMessage));

    await expect(intercept(context, next)).rejects.toMatchObject({ message: originalMessage });
  });

  it("converts matched errors to http errors", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue(new Error("insufficient funds: 10uakt is smaller than 20uakt"));
    const error = await intercept(context, next).catch((e: unknown) => e);

    expect(isHttpError(error)).toBe(true);
  });

  it("passes through non-matching errors unchanged", async () => {
    const { intercept, next, context } = setup();
    const error = new Error("Failed to sign and broadcast transaction");
    next.mockRejectedValue(error);

    await expect(intercept(context, next)).rejects.toBe(error);
  });

  it("passes through non-Error values unchanged", async () => {
    const { intercept, next, context } = setup();
    next.mockRejectedValue("string error");

    await expect(intercept(context, next)).rejects.toBe("string error");
  });

  function setup() {
    const middleware = new ChainErrorMiddleware();
    const next: jest.MockedFn<Next> = jest.fn();
    const context = mock<Context>();

    return { intercept: middleware.intercept(), next, context };
  }
});
