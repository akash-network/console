import { AllowanceHttpService, BalanceHttpService, Denom } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { ErrorService } from "@src/core/services/error/error.service";
import { config } from "@src/deployment/config";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { BlockHttpService } from "@src/deployment/services/block-http/block-http.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpToolsService } from "@src/deployment/services/top-up-tools/top-up-tools.service";
import { TopUpCustodialDeploymentsService } from "./top-up-custodial-deployments.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { BalanceSeeder } from "@test/seeders/balance.seeder";
import { DeploymentGrantSeeder } from "@test/seeders/deployment-grant.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { FeesAuthorizationSeeder } from "@test/seeders/fees-authorization.seeder";
import { stub } from "@test/services/stub";

describe(TopUpCustodialDeploymentsService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const UAKT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const USDT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
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
  const balanceHttpService = new BalanceHttpService();
  const blockHttpService = stub<BlockHttpService>({ getCurrentHeight: jest.fn() });
  const uaktMasterWalletService = mockManagedWalletService(UAKT_TOP_UP_MASTER_WALLET_ADDRESS);
  const usdtMasterWalletService = mockManagedWalletService(USDT_TOP_UP_MASTER_WALLET_ADDRESS);
  const uaktMasterSigningClientService = mockMasterSigningClientService();
  const usdtMasterSigningClientService = mockMasterSigningClientService();
  const topUpToolsService = new TopUpToolsService(
    uaktMasterWalletService,
    usdtMasterWalletService,
    uaktMasterSigningClientService,
    usdtMasterSigningClientService
  );

  jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(CURRENT_BLOCK_HEIGHT);

  const drainingDeploymentService = new DrainingDeploymentService(blockHttpService, stub<LeaseRepository>(), config);
  const errorService = stub<ErrorService>({ execWithErrorHandler: (params: any, cb: () => any) => cb() });

  const topUpDeploymentsService = new TopUpCustodialDeploymentsService(
    topUpToolsService,
    allowanceHttpService,
    balanceHttpService,
    drainingDeploymentService,
    errorService
  );

  type SeedParams = {
    denom: Denom;
    balance?: string;
    grantee: string;
    expectedDeploymentsTopUpCount?: 0 | 1 | 2;
    hasDeployments?: boolean;
    client: MasterSigningClientService;
  };

  const seedFor = ({ denom, balance = "100000000", grantee, expectedDeploymentsTopUpCount = 2, hasDeployments = true, client }: SeedParams) => {
    const owner = AkashAddressSeeder.create();

    return {
      balance: BalanceSeeder.create({ denom, amount: balance }),
      grant: DeploymentGrantSeeder.create({
        granter: owner,
        grantee: grantee,
        authorization: { spend_limit: { denom, amount: "100000000" } }
      }),
      feeAllowance: FeesAuthorizationSeeder.create({
        granter: owner,
        grantee: grantee,
        allowance: { spend_limit: { denom } }
      }),
      drainingDeployments: hasDeployments
        ? [
            {
              deployment: DrainingDeploymentSeeder.create({ denom, blockRate: 50, predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500 }),
              isExpectedToTopUp: !!expectedDeploymentsTopUpCount
            },
            {
              deployment: DrainingDeploymentSeeder.create({ denom, blockRate: 45, predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1700 }),
              isExpectedToTopUp: expectedDeploymentsTopUpCount > 1
            }
          ]
        : [],
      client: client
    };
  };

  const data = [
    seedFor({
      denom: "uakt",
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      client: uaktMasterSigningClientService
    }),
    seedFor({
      denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      client: usdtMasterSigningClientService
    }),
    seedFor({
      denom: "uakt",
      balance: "5500000",
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 1,
      client: uaktMasterSigningClientService
    }),
    seedFor({
      denom: "uakt",
      balance: "5500000",
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      hasDeployments: false,
      client: uaktMasterSigningClientService
    }),
    seedFor({
      denom: "uakt",
      balance: "0",
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 0,
      client: uaktMasterSigningClientService
    })
  ];

  jest.spyOn(allowanceHttpService, "paginateDeploymentGrants").mockImplementation(async (params, cb) => {
    return await cb(data.filter(({ grant }) => "grantee" in params && grant.grantee === params.grantee).map(({ grant }) => grant));
  });
  jest.spyOn(allowanceHttpService, "getFeeAllowanceForGranterAndGrantee").mockImplementation(async (granter: string, grantee: string) => {
    return data.find(({ grant }) => grant.granter === granter && grant.grantee === grantee)?.feeAllowance;
  });
  jest.spyOn(balanceHttpService, "getBalance").mockImplementation(async (address: string, denom: Denom) => {
    return (
      data.find(({ grant }) => grant.granter === address)?.balance || {
        amount: "0",
        denom
      }
    );
  });
  jest.spyOn(drainingDeploymentService, "findDeployments").mockImplementation(async (owner, denom) => {
    return (
      data
        .find(({ grant }) => grant.granter === owner && grant.authorization.spend_limit.denom === denom)
        ?.drainingDeployments?.map(({ deployment }) => deployment) || []
    );
  });
  jest.spyOn(drainingDeploymentService, "calculateTopUpAmount").mockImplementation(async () => faker.number.int({ min: 2000000, max: 4000000 }));
  jest.spyOn(topUpDeploymentsService, "topUpDeployment");

  it("should top up draining deployment given owners have sufficient grants and balances", async () => {
    await topUpDeploymentsService.topUpDeployments();

    expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledTimes(5);

    data.forEach(({ drainingDeployments, client }) => {
      drainingDeployments.forEach(({ isExpectedToTopUp, deployment }) => {
        if (isExpectedToTopUp) {
          expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledWith(expect.any(Number), deployment, client);
        }
      });
    });
  });
});
