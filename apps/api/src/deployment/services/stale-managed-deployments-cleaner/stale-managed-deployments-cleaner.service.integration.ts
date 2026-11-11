import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { CHAIN_DB } from "@src/chain";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { JobQueueService } from "@src/core";
import { StaleManagedDeploymentsCleanerService } from "./stale-managed-deployments-cleaner.service";

import { createDeployment, seedUserWithWallet } from "@test/seeders";

const DEPOSIT = 500_000;
const INDEXED_HEIGHT = 1_000;

describe(StaleManagedDeploymentsCleanerService.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets through a create refused for an empty grant once it has closed the deployment holding the deposit", async () => {
    const { service, signerService, findWallet, createMessage } = await setup();
    await expect(signerService.assertCanBroadcastByUserWallet(await findWallet(), [createMessage])).rejects.toMatchObject({ status: 402 });

    await service.cleanUpForWallet(await findWallet(), 0);

    await expect(signerService.assertCanBroadcastByUserWallet(await findWallet(), [createMessage])).resolves.toBeUndefined();
  });

  it("stores the allowance the close returned on the wallet", async () => {
    const { service, findWallet } = await setup();

    await service.cleanUpForWallet(await findWallet(), 0);

    expect((await findWallet()).deploymentAllowance).toBe(DEPOSIT);
  });

  async function setup() {
    const { wallet, address } = await seedUserWithWallet({ deploymentAllowance: "0", activatedAt: new Date() });
    await createDeployment({ owner: address, dseq: faker.string.numeric({ length: 10, allowLeadingZeros: false }), createdHeight: INDEXED_HEIGHT - 1 });
    let grantOnChain = 0;

    vi.spyOn(container.resolve(BlockRepository), "getLatestProcessedHeight").mockResolvedValue(INDEXED_HEIGHT);
    const jobQueueService = container.resolve(JobQueueService);
    vi.spyOn(jobQueueService, "findPendingSingletonKeys").mockResolvedValue(new Set());
    vi.spyOn(jobQueueService, "enqueue").mockResolvedValue("job-id");
    vi.spyOn(container.resolve(LeaseHttpService), "list").mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });

    const balancesService = container.resolve(BalancesService);
    vi.spyOn(balancesService, "retrieveDeploymentLimit").mockImplementation(async () => grantOnChain);
    vi.spyOn(balancesService, "retrieveAndCalcFeeLimit").mockResolvedValue(Number(wallet.feeAllowance));
    vi.spyOn(balancesService, "toFiatAmount").mockResolvedValue(0);

    const signerService = container.resolve(ManagedSignerService);
    vi.spyOn(signerService, "executeDerivedTx").mockImplementation(async () => {
      grantOnChain += DEPOSIT;
      return { code: 0, hash: "CLOSEHASH", rawLog: "[]" };
    });

    const createMessage = container.resolve(RpcMessageService).getCreateDeploymentMsg({
      owner: address,
      dseq: faker.string.numeric({ length: 10, allowLeadingZeros: false }),
      groups: [],
      hash: new Uint8Array(32),
      denom: container.resolve(BillingConfigService).get("DEPLOYMENT_GRANT_DENOM"),
      amount: DEPOSIT
    });

    const userWalletRepository = container.resolve(UserWalletRepository);
    const findWallet = async () => (await userWalletRepository.findById(wallet.id)) as UserWalletOutput;

    return {
      service: container.resolve(StaleManagedDeploymentsCleanerService),
      signerService,
      findWallet,
      createMessage
    };
  }
});
