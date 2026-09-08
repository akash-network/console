import "@src/app/providers/jobs.provider";

import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { WalletCreditsLowCheckHandler } from "@src/billing/services/wallet-credits-low-check/wallet-credits-low-check.handler";
import { JOB_NAME } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { FundDrainingDeploymentsHandler } from "./fund-draining-deployments.handler";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const LATEST_BLOCK_PATH = "/cosmos/base/tendermint/v1beta1/blocks/latest";
const CURRENT_HEIGHT = "28343549";

const jobWorkers = useJobWorkers(() => [container.resolve(FundDrainingDeploymentsHandler), container.resolve(WalletCreditsLowCheckHandler)]);

describe(FundDrainingDeploymentsHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("still schedules the credits low check when the owner has nothing draining", async () => {
    const { fundDraining, findCreditsLowCheck } = await setup();

    await fundDraining();

    expect(await findCreditsLowCheck()).toBeDefined();
  });

  it("still schedules the credits low check when the top up cannot run at all", async () => {
    const { dispatchFundDraining, awaitFundingRetrying, findCreditsLowCheck } = await setup({ topUpUnavailable: true });

    await dispatchFundDraining();
    await awaitFundingRetrying();

    expect(await findCreditsLowCheck()).toBeDefined();
  });

  it("schedules no credits low check for a wallet whose auto reload is on", async () => {
    const { fundDraining, findCreditsLowCheck } = await setup({ autoReload: true });

    await fundDraining();

    expect(await findCreditsLowCheck()).toBeUndefined();
  });

  async function setup(input: { topUpUnavailable?: boolean; autoReload?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, wallet, address } = await seedUserWithWallet();

    await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: input.autoReload ?? false });

    nock(container.resolve(CoreConfigService).get("REST_API_NODE_URL"))
      .persist()
      .get(LATEST_BLOCK_PATH)
      .query(true)
      .reply(200, { block_id: {}, block: { header: { height: CURRENT_HEIGHT, time: new Date().toISOString(), chain_id: "akashnet-2" } } });

    const findDraining = vi.spyOn(container.resolve(DrainingDeploymentService), "findDrainingDeploymentsForOwner");
    if (input.topUpUnavailable) findDraining.mockRejectedValue(new Error("indexer unavailable"));
    else findDraining.mockResolvedValue([]);
    vi.spyOn(container.resolve(WalletCreditsLowCheckHandler), "handle").mockResolvedValue();

    const fundingKey = `fundDrainingDeployments.${wallet.id}`;

    return {
      findCreditsLowCheck: async () => (await findJobRows(WalletCreditsLowCheck[JOB_NAME], { singletonKey: `${WalletCreditsLowCheck.name}.${user.id}` }))[0],
      dispatchFundDraining: async () => {
        await enqueue(new FundDrainingDeploymentsCommand({ walletId: wallet.id, address }), { singletonKey: fundingKey });
        await startWorkers();
      },
      awaitFundingRetrying: () =>
        vi.waitFor(
          async () => {
            const [row] = await findJobRows(FundDrainingDeploymentsCommand[JOB_NAME], { singletonKey: fundingKey });
            expect(row?.state).toBe("retry");
          },
          { timeout: 20_000, interval: 250 }
        ),
      fundDraining: async () => {
        await enqueue(new FundDrainingDeploymentsCommand({ walletId: wallet.id, address }), { singletonKey: fundingKey });
        await startWorkers();
        await expectJobCompleted(FundDrainingDeploymentsCommand[JOB_NAME], { singletonKey: fundingKey });
      }
    };
  }
});
