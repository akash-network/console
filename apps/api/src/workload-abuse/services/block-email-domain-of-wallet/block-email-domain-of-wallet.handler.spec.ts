import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { EmailDomainBlockService } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { BlockEmailDomainOfWalletHandler, blockEmailDomainOfWalletKeyFor } from "./block-email-domain-of-wallet.handler";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYLOAD = { walletId: 42, version: 1 as const };

describe(BlockEmailDomainOfWalletHandler.name, () => {
  it("keys the block by wallet, so a second detection of the same wallet does not queue a second evaluation", () => {
    expect(blockEmailDomainOfWalletKeyFor(7)).toBe("blockEmailDomainOfWallet.7");
  });

  it("blocks the domain of the wallet it was given", async () => {
    const { handler, wallet, emailDomainBlockService } = setup({ wallet: createUserWallet({ isTrialing: false, abuseLockedAt: new Date() }) });

    await handler.handle(PAYLOAD);

    expect(emailDomainBlockService.blockDomainOf).toHaveBeenCalledWith(wallet);
  });

  it("skips a wallet it cannot find", async () => {
    const { handler, emailDomainBlockService, instrumentation, logger } = setup({ wallet: null });

    await handler.handle(PAYLOAD);

    expect(emailDomainBlockService.blockDomainOf).not.toHaveBeenCalled();
    expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "wallet_not_found");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED", reason: "wallet_not_found" }));
  });

  it("records a failure and rethrows it, so the queue retries the block", async () => {
    const { handler, emailDomainBlockService, instrumentation, logger } = setup({ wallet: createUserWallet({ isTrialing: false }) });
    emailDomainBlockService.blockDomainOf.mockRejectedValue(new Error("connection terminated"));

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("connection terminated");

    expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("failed");
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_FAILED", walletId: PAYLOAD.walletId }));
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({ wallet: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { wallet: ReturnType<typeof createUserWallet> | null }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findById.mockResolvedValue(input.wallet ?? undefined);
    const emailDomainBlockService = mock<EmailDomainBlockService>();
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new BlockEmailDomainOfWalletHandler(userWalletRepository, emailDomainBlockService, instrumentation, createLogger);

    return { handler, wallet: input.wallet!, userWalletRepository, emailDomainBlockService, instrumentation, logger };
  }
});
