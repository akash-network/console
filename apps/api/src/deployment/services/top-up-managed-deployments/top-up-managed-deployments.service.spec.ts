import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";

import { BillingConfig } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService, Wallet } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { config } from "@src/deployment/config";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";
import { stub } from "@test/services/stub";

describe(TopUpManagedDeploymentsService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const MANAGED_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const balancesService = stub<BalancesService>({ retrieveAndCalcDeploymentLimit: jest.fn() });
  const userWalletRepository = stub<UserWalletRepository>({ paginate: jest.fn() });
  const blockHttpService = stub<BlockHttpService>({ getCurrentHeight: () => CURRENT_BLOCK_HEIGHT });
  const managedSignerService = stub<ManagedSignerService>({ executeManagedTx: jest.fn() });
  const billingConfig = stub<BillingConfig>({ DEPLOYMENT_GRANT_DENOM: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" });
  const managedMasterWalletService = stub<Wallet>({
    getFirstAddress: async () => MANAGED_MASTER_WALLET_ADDRESS
  });

  const drainingDeploymentService = new DrainingDeploymentService(blockHttpService, stub<LeaseRepository>(), config);
  const errorService = stub<ErrorService>({ execWithErrorHandler: (params: any, cb: () => any) => cb() });
  const topUpDeploymentsService = new TopUpManagedDeploymentsService(
    userWalletRepository,
    managedSignerService,
    billingConfig,
    drainingDeploymentService,
    managedMasterWalletService,
    balancesService,
    new RpcMessageService(),
    blockHttpService,
    errorService
  );

  type SeedParams = {
    balance?: string;
    expectedDeploymentsTopUpCount?: 0 | 1 | 2;
    hasDeployments?: boolean;
  };

  const seedFor = ({ balance = "100000000", expectedDeploymentsTopUpCount = 2, hasDeployments = true }: SeedParams) => {
    const wallet = UserWalletSeeder.create();

    return {
      wallet,
      balance,
      drainingDeployments: hasDeployments
        ? [
            {
              deployment: DrainingDeploymentSeeder.create({
                denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
                blockRate: 50,
                predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500
              }),
              isExpectedToTopUp: !!expectedDeploymentsTopUpCount
            },
            {
              deployment: DrainingDeploymentSeeder.create({
                denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
                blockRate: 45,
                predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1700
              }),
              isExpectedToTopUp: expectedDeploymentsTopUpCount > 1
            }
          ]
        : []
    };
  };

  const data = [
    seedFor({}),
    seedFor({ balance: "50000000", expectedDeploymentsTopUpCount: 2 }),
    seedFor({ balance: "1408022", expectedDeploymentsTopUpCount: 1 }),
    seedFor({ hasDeployments: false }),
    seedFor({ balance: "0", expectedDeploymentsTopUpCount: 0 })
  ];

  userWalletRepository.paginate.mockImplementation((params, cb) => cb(data.map(({ wallet }) => wallet)));

  jest.spyOn(drainingDeploymentService, "findDeployments").mockImplementation(async owner => {
    return data.find(({ wallet }) => wallet.address == owner)?.drainingDeployments?.map(({ deployment }) => deployment) || [];
  });
  jest.spyOn(drainingDeploymentService, "calculateTopUpAmount").mockImplementation(async () => faker.number.int({ min: 3500000, max: 4000000 }));
  balancesService.retrieveAndCalcDeploymentLimit.mockImplementation(async wallet => {
    return parseInt(data.find(({ wallet: w }) => w.address == wallet.address)?.balance);
  });

  it("should top up draining deployment given owners have sufficient balances", async () => {
    await topUpDeploymentsService.topUpDeployments({ dryRun: false });

    let count = 0;

    data.forEach(({ wallet, drainingDeployments }) => {
      drainingDeployments.forEach(({ isExpectedToTopUp, deployment }) => {
        if (isExpectedToTopUp) {
          expect(managedSignerService.executeManagedTx).toHaveBeenCalledWith(wallet.id, [
            {
              typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
              value: {
                id: {
                  owner: wallet.address,
                  dseq: { high: 0, low: deployment.dseq, unsigned: true }
                },
                amount: {
                  denom: deployment.denom,
                  amount: expect.any(String)
                },
                depositor: MANAGED_MASTER_WALLET_ADDRESS
              }
            }
          ]);
          count++;
        }
      });
    });
    expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(count);
  });
});
