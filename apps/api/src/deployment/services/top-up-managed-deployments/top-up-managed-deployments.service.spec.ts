import { AllowanceHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { ErrorService } from "@src/core/services/error/error.service";
import { config } from "@src/deployment/config";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { BlockHttpService } from "@src/deployment/services/block-http/block-http.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { DeploymentGrantSeeder } from "@test/seeders/deployment-grant.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { stub } from "@test/services/stub";

describe(TopUpManagedDeploymentsService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const MANAGED_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const mockManagedWalletService = (address: string) => {
    return stub<MasterWalletService>({
      getFirstAddress: async () => address
    });
  };
  const mockMasterSigningClientService = () => {
    return stub<MasterSigningClientService>({
      execTx: jest.fn()
    });
  };

  const allowanceHttpService = new AllowanceHttpService();
  const blockHttpService = stub<BlockHttpService>({ getCurrentHeight: jest.fn() });
  const managedMasterWalletService = mockManagedWalletService(MANAGED_MASTER_WALLET_ADDRESS);
  const managedMasterSigningClientService = mockMasterSigningClientService();

  jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(CURRENT_BLOCK_HEIGHT);

  const drainingDeploymentService = new DrainingDeploymentService(blockHttpService, stub<LeaseRepository>(), config);
  const errorService = stub<ErrorService>({ execWithErrorHandler: (params: any, cb: () => any) => cb() });
  const topUpDeploymentsService = new TopUpManagedDeploymentsService(
    allowanceHttpService,
    managedMasterWalletService,
    managedMasterSigningClientService,
    drainingDeploymentService,
    errorService
  );

  type SeedParams = {
    balance?: string;
    expectedDeploymentsTopUpCount?: 0 | 1 | 2;
    hasDeployments?: boolean;
  };

  const seedFor = ({ balance = "100000000", expectedDeploymentsTopUpCount = 2, hasDeployments = true }: SeedParams) => {
    const owner = AkashAddressSeeder.create();

    return {
      grant: DeploymentGrantSeeder.create({
        granter: MANAGED_MASTER_WALLET_ADDRESS,
        grantee: owner,
        authorization: { spend_limit: { denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", amount: balance } }
      }),
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
    seedFor({ balance: "5000000", expectedDeploymentsTopUpCount: 1 }),
    seedFor({ hasDeployments: false }),
    seedFor({ balance: "0", expectedDeploymentsTopUpCount: 0 })
  ];

  jest.spyOn(allowanceHttpService, "paginateDeploymentGrants").mockImplementation(async (params, cb) => {
    return await cb(data.map(({ grant }) => grant));
  });
  jest.spyOn(drainingDeploymentService, "findDeployments").mockImplementation(async (owner, denom) => {
    return (
      data
        .find(({ grant }) => grant.grantee == owner && grant.authorization.spend_limit.denom === denom)
        ?.drainingDeployments?.map(({ deployment }) => deployment) || []
    );
  });
  jest.spyOn(drainingDeploymentService, "calculateTopUpAmount").mockImplementation(async () => faker.number.int({ min: 2000000, max: 4000000 }));
  jest.spyOn(topUpDeploymentsService, "topUpDeployment");

  it("should top up draining deployment given owners have sufficient balances", async () => {
    await topUpDeploymentsService.topUpDeployments();

    let count = 0;

    data.forEach(({ drainingDeployments }) => {
      drainingDeployments.forEach(({ isExpectedToTopUp, deployment }) => {
        if (isExpectedToTopUp) {
          expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledWith(expect.any(Number), deployment);
          count++;
        }
      });
    });
    expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledTimes(count);
  });
});
