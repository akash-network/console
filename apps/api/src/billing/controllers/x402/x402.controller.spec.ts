import { faker } from "@faker-js/faker";
import { HttpError } from "http-errors";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { BillingConfig } from "@src/billing/providers";
import type { X402TransactionOutput, X402TransactionRepository } from "@src/billing/repositories";
import type { X402Service } from "@src/billing/services/x402/x402.service";
import { X402_ERROR_CODES } from "@src/billing/services/x402/x402-error-codes";
import { X402Controller } from "./x402.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(X402Controller.name, () => {
  describe("listTransactions", () => {
    it("scopes the query to the authenticated user so it cannot read another user's rows", async () => {
      const { controller, user, ability, x402TransactionRepository, scopedRepository } = setup();
      const transaction = createTransaction({ userId: user.id });
      scopedRepository.findByUserPaginated.mockResolvedValue({ transactions: [transaction], total: 1 });

      const result = await controller.listTransactions({ limit: 25, offset: 0 });

      expect(x402TransactionRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(scopedRepository.findByUserPaginated).toHaveBeenCalledWith({ userId: user.id, limit: 25, offset: 0 });
      expect(result).toEqual({
        data: [
          {
            transactionId: transaction.id,
            status: transaction.status,
            amountUsdCents: transaction.amount,
            currency: transaction.currency,
            network: transaction.network,
            asset: transaction.asset,
            settlementTxHash: transaction.settlementTxHash,
            payerAddress: transaction.payerAddress,
            createdAt: transaction.createdAt.toISOString()
          }
        ],
        pagination: { limit: 25, offset: 0, total: 1 }
      });
    });

    it("never passes a caller-supplied userId to the repository", async () => {
      const { controller, user, scopedRepository } = setup();
      scopedRepository.findByUserPaginated.mockResolvedValue({ transactions: [], total: 0 });

      await controller.listTransactions({ limit: 10, offset: 5 });

      expect(scopedRepository.findByUserPaginated).toHaveBeenCalledWith({ userId: user.id, limit: 10, offset: 5 });
    });
  });

  describe("topUp error codes", () => {
    it("rejects a disabled deployment with the X402_DISABLED code", async () => {
      const { controller } = setup({ isEnabled: false });

      const error = await controller.topUp(mock(), 25).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(404);
      expect((error as HttpError).data).toEqual({ errorCode: X402_ERROR_CODES.X402_DISABLED });
    });

    it("rejects an out-of-bounds amount with the AMOUNT_OUT_OF_BOUNDS code", async () => {
      const { controller } = setup();

      const error = await controller.topUp(mock(), 10_000).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).data).toEqual({ errorCode: X402_ERROR_CODES.AMOUNT_OUT_OF_BOUNDS });
    });
  });

  function setup({ isEnabled = true }: { isEnabled?: boolean } = {}) {
    const user = createUser();
    const ability = mock<AuthService["ability"]>();
    const authService = mock<AuthService>({ currentUser: user, ability, isAuthenticated: true });
    container.registerInstance(AuthService, authService);

    const config = mock<BillingConfig>();
    Object.assign(config, { X402_MIN_TOP_UP_USD: 1, X402_MAX_TOP_UP_USD: 1000 });

    const x402Service = mock<X402Service>({ isEnabled });

    const scopedRepository = mock<X402TransactionRepository>();
    const x402TransactionRepository = mock<X402TransactionRepository>();
    x402TransactionRepository.accessibleBy.mockReturnValue(scopedRepository);

    const controller = new X402Controller(config, x402Service, x402TransactionRepository, authService);

    return { controller, user, ability, authService, config, x402Service, x402TransactionRepository, scopedRepository };
  }

  function createTransaction(overrides: Partial<X402TransactionOutput> = {}): X402TransactionOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      status: "succeeded",
      amount: 2500,
      currency: "usd",
      network: "eip155:8453",
      asset: "0xusdc",
      paymentHash: faker.string.alphanumeric(64),
      payerAddress: "0xpayer",
      settlementTxHash: "0xsettlement",
      errorMessage: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides
    };
  }
});
