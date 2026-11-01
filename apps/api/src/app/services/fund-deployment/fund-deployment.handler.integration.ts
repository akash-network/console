import "@src/app/providers/jobs.provider";

import { addHours } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { WalletCreditsLowCheckHandler } from "@src/billing/services/wallet-credits-low-check/wallet-credits-low-check.handler";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { JOB_NAME } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { FundDeploymentHandler } from "./fund-deployment.handler";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDrainingDeployment } from "@test/seeders/draining-deployment.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(FundDeploymentHandler), container.resolve(WalletCreditsLowCheckHandler)]);

describe(FundDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("still schedules the credits low check when funding is skipped for a closed deployment", async () => {
    const { fundDeployment, findCreditsLowCheck } = await setup({ lease: "closed" });

    await fundDeployment();

    expect(await findCreditsLowCheck()).toBeDefined();
  });

  it("still schedules the credits low check when the lease is not visible on chain yet", async () => {
    const { dispatchFundDeployment, awaitFundingRetrying, findCreditsLowCheck } = await setup({ lease: "missing" });

    await dispatchFundDeployment();
    await awaitFundingRetrying();

    expect(await findCreditsLowCheck()).toBeDefined();
  });

  it("schedules no credits low check for a wallet whose auto reload is on", async () => {
    const { fundDeployment, findCreditsLowCheck } = await setup({ lease: "closed", autoReload: true });

    await fundDeployment();

    expect(await findCreditsLowCheck()).toBeUndefined();
  });

  it("leaves the runtime and funding of a team deployment its user filed under the same dseq alone", async () => {
    const { fundDeployment, seedTeamDeployment } = await setup({ lease: "live" });
    const teamDeployment = await seedTeamDeployment({ runtimeLimitHours: 24 });

    await fundDeployment();

    expect(await container.resolve(DeploymentSettingRepository).findById(teamDeployment.id)).toMatchObject({ runtimeEndsAt: null, lastFundedAt: null });
  });

  it("refuses a second funding job for the same deployment while the first is still queued", async () => {
    const { queueFundingForLater } = await setup({ lease: "missing" });

    const first = await queueFundingForLater();
    const second = await queueFundingForLater();

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
  });

  async function setup(input: { lease: "closed" | "missing" | "live"; autoReload?: boolean }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, wallet, address } = await seedUserWithWallet();
    const dseq = createDseq();

    await seedWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input.autoReload ?? false
    });

    vi.spyOn(container.resolve(DrainingDeploymentService), "findLeases").mockResolvedValue(
      input.lease === "missing"
        ? []
        : [createDrainingDeployment({ dseq: Number(dseq), isClosed: input.lease === "closed", predictedClosedHeight: Number.MAX_SAFE_INTEGER })]
    );
    vi.spyOn(container.resolve(BlockHttpService), "getCurrentHeight").mockResolvedValue(1);
    vi.spyOn(container.resolve(WalletCreditsLowCheckHandler), "handle").mockResolvedValue();

    const fundingKey = `fundDeployment.${wallet.id}.${dseq}`;

    return {
      seedTeamDeployment: async (overrides: { runtimeLimitHours: number }) => {
        const { organization: team } = await seedOrganizationWithOwner();
        await seedOrganizationMember({ organizationId: team.id, userId: user.id });

        return await seedDeploymentSetting({ userId: user.id, dseq, organizationId: team.id, ...overrides });
      },
      queueFundingForLater: () =>
        enqueue(new FundDeploymentCommand({ walletId: wallet.id, address, dseq }), {
          singletonKey: fundingKey,
          startAfter: addHours(new Date(), 1).toISOString()
        }),
      findCreditsLowCheck: async () => (await findJobRows(WalletCreditsLowCheck[JOB_NAME], { singletonKey: `${WalletCreditsLowCheck.name}.${user.id}` }))[0],
      dispatchFundDeployment: async () => {
        await enqueue(new FundDeploymentCommand({ walletId: wallet.id, address, dseq }), { singletonKey: fundingKey });
        await startWorkers();
      },
      awaitFundingRetrying: () =>
        vi.waitFor(
          async () => {
            const [row] = await findJobRows(FundDeploymentCommand[JOB_NAME], { singletonKey: fundingKey });
            expect(row?.state).toBe("retry");
          },
          { timeout: 20_000, interval: 250 }
        ),
      fundDeployment: async () => {
        await enqueue(new FundDeploymentCommand({ walletId: wallet.id, address, dseq }), { singletonKey: fundingKey });
        await startWorkers();
        await expectJobCompleted(FundDeploymentCommand[JOB_NAME], { singletonKey: fundingKey });
      }
    };
  }
});
