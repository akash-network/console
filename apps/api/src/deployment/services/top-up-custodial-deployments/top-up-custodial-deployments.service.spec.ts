import { AllowanceHttpService, BalanceHttpService, BlockHttpService, Denom } from "@akashnetwork/http-sdk";
import { container } from "tsyringe";

import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import type { Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { config } from "@src/deployment/config";
import { DrainingLeasesOptions, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { TopUpCustodialDeploymentsService } from "./top-up-custodial-deployments.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { BalanceSeeder } from "@test/seeders/balance.seeder";
import { DeploymentGrantSeeder } from "@test/seeders/deployment-grant.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { FeesAuthorizationSeeder } from "@test/seeders/fees-authorization.seeder";

describe(TopUpCustodialDeploymentsService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const UAKT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const USDT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const mockManagedWalletService = (address: string) => {
    return {
      getFirstAddress: async () => address
    } as unknown as MasterWalletService;
  };
  const mockMasterSigningClientService = () => {
    return {
      execTx: jest.fn()
    } as unknown as MasterSigningClientService;
  };

  const allowanceHttpService = new AllowanceHttpService();
  const balanceHttpService = new BalanceHttpService();
  const blockHttpService = new BlockHttpService();
  const uaktMasterWalletService = mockManagedWalletService(UAKT_TOP_UP_MASTER_WALLET_ADDRESS);
  const usdtMasterWalletService = mockManagedWalletService(USDT_TOP_UP_MASTER_WALLET_ADDRESS);
  const uaktMasterSigningClientService = mockMasterSigningClientService();
  const usdtMasterSigningClientService = mockMasterSigningClientService();

  jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(CURRENT_BLOCK_HEIGHT);

  const leaseRepository = container.resolve(LeaseRepository);
  jest.spyOn(leaseRepository, "findDrainingLeases").mockResolvedValue([]);
  const sentryEventService = container.resolve(SentryEventService);
  const sentry = {
    captureEvent: jest.fn()
  } as unknown as Sentry;
  const topUpDeploymentsService = new TopUpCustodialDeploymentsService(
    allowanceHttpService,
    balanceHttpService,
    blockHttpService,
    uaktMasterWalletService,
    usdtMasterWalletService,
    uaktMasterSigningClientService,
    usdtMasterSigningClientService,
    leaseRepository,
    config,
    sentry,
    sentryEventService
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
              expectedTopUpAmount: expectedDeploymentsTopUpCount ? 4897959 : undefined
            },
            {
              deployment: DrainingDeploymentSeeder.create({ denom, blockRate: 45, predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1700 }),
              expectedTopUpAmount: expectedDeploymentsTopUpCount > 1 ? 4408163 : undefined
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
  jest.spyOn(leaseRepository, "findDrainingLeases").mockImplementation(async ({ owner, denom }: DrainingLeasesOptions) => {
    return (
      data
        .find(({ grant }) => grant.granter === owner && grant.authorization.spend_limit.denom === denom)
        ?.drainingDeployments?.map(({ deployment }) => deployment) || []
    );
  });
  jest.spyOn(topUpDeploymentsService, "topUpDeployment");

  it("should top up draining deployment given owners have sufficient grants and balances", async () => {
    await topUpDeploymentsService.topUpDeployments();

    expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledTimes(5);

    data.forEach(({ drainingDeployments, client }) => {
      drainingDeployments.forEach(({ expectedTopUpAmount, deployment }) => {
        if (expectedTopUpAmount) {
          expect(topUpDeploymentsService.topUpDeployment).toHaveBeenCalledWith(expectedTopUpAmount, deployment, client);
        }
      });
    });
  });
});
