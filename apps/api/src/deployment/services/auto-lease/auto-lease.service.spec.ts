import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { WalletInitialized } from "@src/billing/repositories";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { JobQueueService } from "@src/core";
import { matchingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { AutoLease, autoLeaseKeyFor } from "./auto-lease.job";
import { AutoLeaseService } from "./auto-lease.service";

import { createInitializedUserWallet, createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(AutoLeaseService.name, () => {
  const NOW = new Date("2026-10-26T10:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the match's activity in the member's feed and queues its first tick under one key per deployment", async () => {
    const wallet = createInitializedUserWallet({ organizationId: null });
    const { service, activityService, jobQueueService } = setup({ wallet });

    await service.start({ userId: wallet.userId, walletId: wallet.id, dseq: "1000" });

    const [opened] = activityService.open.mock.calls[0];
    expect(opened).toEqual({ id: expect.any(String), ...matchingLeaseActivityOf({ userId: wallet.userId, dseq: "1000" }), organizationId: null });
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new AutoLease({ userId: wallet.userId, walletId: wallet.id, owner: wallet.address, dseq: "1000", activityId: opened.id, startedAt: NOW.toISOString() }),
      { singletonKey: autoLeaseKeyFor({ owner: wallet.address, dseq: "1000" }), retryLimit: 3, retryBackoff: true, retryDelay: 5, retryDelayMax: 30 }
    );
  });

  it("files a team wallet's match under its organization and has the tick sign with the team wallet", async () => {
    const wallet = createOrganizationWallet();
    const { service, activityService, jobQueueService } = setup({ wallet });

    await service.start({ userId: "member-1", walletId: wallet.id, dseq: "1000" });

    expect(activityService.open).toHaveBeenCalledWith(expect.objectContaining({ userId: "member-1", organizationId: wallet.organizationId }));
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "member-1", walletId: wallet.id, organizationId: wallet.organizationId }) }),
      expect.anything()
    );
  });

  function setup(input: { wallet: WalletInitialized }) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletById.mockResolvedValue(input.wallet);
    const activityService = mock<ActivityService>();
    const jobQueueService = mock<JobQueueService>();

    const service = new AutoLeaseService(walletReaderService, activityService, jobQueueService);

    return { service, walletReaderService, activityService, jobQueueService };
  }
});
