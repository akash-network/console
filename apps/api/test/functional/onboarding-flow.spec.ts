import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingStartedHandler } from "@src/app/services/onboarding-started/onboarding-started.handler";
import type { OnboardingStarted } from "@src/billing/events/onboarding-started";
import type { BillingConfig } from "@src/billing/providers";
import { BILLING_CONFIG } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import type { ApiPgDatabase, EventPayload } from "@src/core";
import { CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { app } from "@src/rest-app";

import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Onboarding flow (console_onboarding_redesign FF on)", () => {
  const walletService = new WalletTestingService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const billingConfig = container.resolve<BillingConfig>(BILLING_CONFIG);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = resolveTable("UserWallets");

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("returns 503 with Retry-After while wallet is pending", { timeout: 60_000 }, async () => {
    const { user, token } = await walletService.createRegisteredUser();
    await db.insert(userWalletsTable).values({ userId: user.id, status: "pending" });

    const res = await app.request("/v1/tx", {
      method: "POST",
      body: JSON.stringify({ data: { userId: user.id, messages: [] } }),
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
    });

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("2");
  });

  it("creates and authorizes the onboarding wallet, then flips status to ready", { timeout: 90_000 }, async () => {
    mockChainGrantSuccess();
    const { user } = await walletService.createRegisteredUser();

    const handler = container.resolve(OnboardingStartedHandler);
    await handler.handle({ userId: user.id, version: 1 } as EventPayload<OnboardingStarted>);

    const readyWallet = await userWalletRepository.findOneByUserId(user.id);
    expect(readyWallet).toMatchObject({
      status: "ready",
      address: expect.stringMatching(/^akash1/)
    });
  });

  it("flips wallet status to failed when the chain grant throws", { timeout: 60_000 }, async () => {
    const { user } = await walletService.createRegisteredUser();
    const managedUserWallet = container.resolve(ManagedUserWalletService);
    vi.spyOn(managedUserWallet, "createAndAuthorizeOnboardingGrant").mockRejectedValue(new Error("chain down"));

    const handler = container.resolve(OnboardingStartedHandler);
    await expect(handler.handle({ userId: user.id, version: 1 } as EventPayload<OnboardingStarted>)).rejects.toThrow("chain down");

    const failedWallet = await userWalletRepository.findOneByUserId(user.id);
    expect(failedWallet?.status).toBe("failed");
  });

  function mockChainGrantSuccess() {
    nock(billingConfig.TX_SIGNER_BASE_URL)
      .persist()
      .post("/v1/tx/funding")
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, createFeeAllowanceResponse());
  }
});
