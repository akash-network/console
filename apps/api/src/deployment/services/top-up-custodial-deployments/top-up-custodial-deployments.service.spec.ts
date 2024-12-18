import "@test/mocks/logger-service.mock";

import { AuthzHttpService, BalanceHttpService, Denom } from "@akashnetwork/http-sdk";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { secondsInWeek } from "date-fns/constants";
import { describe } from "node:test";
import { container } from "tsyringe";

import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { UAKT_TOP_UP_MASTER_WALLET } from "@src/billing/providers/wallet.provider";
import { BatchSigningClientService, RpcMessageService, Wallet } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { config } from "@src/deployment/config";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpToolsService } from "@src/deployment/services/top-up-tools/top-up-tools.service";
import { TopUpCustodialDeploymentsService } from "./top-up-custodial-deployments.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { BalanceSeeder } from "@test/seeders/balance.seeder";
import { DeploymentGrantSeeder } from "@test/seeders/deployment-grant.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { FeesAuthorizationSeeder } from "@test/seeders/fees-authorization.seeder";
import { stub } from "@test/services/stub";

const USDC_IBC_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";

describe(TopUpCustodialDeploymentsService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const UAKT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const USDT_TOP_UP_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const mockManagedWallet = (address: string) => {
    return stub<Wallet>({
      getFirstAddress: async () => address
    });
  };
  const mockMasterSigningClient = () => {
    return stub<BatchSigningClientService>({
      executeTx: jest.fn()
    });
  };

  const authzHttpService = new AuthzHttpService();
  const balanceHttpService = new BalanceHttpService();
  const blockHttpService = stub<BlockHttpService>({ getCurrentHeight: jest.fn() });
  const uaktMasterWallet = mockManagedWallet(UAKT_TOP_UP_MASTER_WALLET_ADDRESS);
  const usdtMasterWallet = mockManagedWallet(USDT_TOP_UP_MASTER_WALLET_ADDRESS);
  const uaktMasterSigningClient = mockMasterSigningClient();
  const usdtMasterSigningClient = mockMasterSigningClient();
  const topUpToolsService = new TopUpToolsService(uaktMasterWallet, usdtMasterWallet, uaktMasterSigningClient, usdtMasterSigningClient);

  jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(CURRENT_BLOCK_HEIGHT);

  const drainingDeploymentService = new DrainingDeploymentService(blockHttpService, stub<LeaseRepository>(), config);
  const errorService = stub<ErrorService>({ execWithErrorHandler: (params: any, cb: () => any) => cb() });

  const topUpDeploymentsService = new TopUpCustodialDeploymentsService(
    topUpToolsService,
    authzHttpService,
    balanceHttpService,
    drainingDeploymentService,
    new RpcMessageService(),
    blockHttpService,
    errorService
  );

  type SeedParams = {
    denom: Denom;
    balance?: number;
    feesBalance?: number;
    grantee: string;
    expectedDeploymentsTopUpCount?: 0 | 1 | 2;
    hasDeployments?: boolean;
  };

  const seedFor = ({ denom, balance = 100000000, feesBalance = 1000000, grantee, expectedDeploymentsTopUpCount = 2, hasDeployments = true }: SeedParams) => {
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
        allowance: { spend_limit: { denom: "uakt" } }
      }),
      feesBalance: denom === "uakt" ? undefined : BalanceSeeder.create({ denom: "uakt", amount: feesBalance }),
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
        : []
    };
  };

  const data = [
    seedFor({
      denom: "uakt",
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      balance: 5500000,
      expectedDeploymentsTopUpCount: 2
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      balance: 5040000,
      expectedDeploymentsTopUpCount: 1
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      balance: 5500000,
      expectedDeploymentsTopUpCount: 2
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      feesBalance: 0,
      expectedDeploymentsTopUpCount: 0
    }),
    seedFor({
      denom: USDC_IBC_DENOM,
      grantee: USDT_TOP_UP_MASTER_WALLET_ADDRESS,
      feesBalance: 5000,
      expectedDeploymentsTopUpCount: 1
    }),
    seedFor({
      denom: "uakt",
      balance: 5045000,
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 1
    }),
    seedFor({
      denom: "uakt",
      balance: 5000,
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 0
    }),
    seedFor({
      denom: "uakt",
      balance: 10000,
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 1
    }),
    seedFor({
      denom: "uakt",
      balance: 5500000,
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      hasDeployments: false
    }),
    seedFor({
      denom: "uakt",
      balance: 0,
      grantee: UAKT_TOP_UP_MASTER_WALLET_ADDRESS,
      expectedDeploymentsTopUpCount: 0
    })
  ];

  jest.spyOn(authzHttpService, "paginateDepositDeploymentGrants").mockImplementation(async (params, cb) => {
    return await cb(data.filter(({ grant }) => "grantee" in params && grant.grantee === params.grantee).map(({ grant }) => grant));
  });
  jest.spyOn(authzHttpService, "getFeeAllowanceForGranterAndGrantee").mockImplementation(async (granter: string, grantee: string) => {
    return data.find(({ grant }) => grant.granter === granter && grant.grantee === grantee)?.feeAllowance;
  });
  jest.spyOn(balanceHttpService, "getBalance").mockImplementation(async (address: string, denom: Denom) => {
    const record = data.find(({ grant }) => grant.granter === address);

    if (record?.balance.denom === denom) {
      return record.balance;
    }

    if (record?.feesBalance.denom === denom) {
      return record.feesBalance;
    }

    return {
      amount: 0,
      denom
    };
  });
  jest.spyOn(drainingDeploymentService, "findDeployments").mockImplementation(async (owner, denom) => {
    return (
      data
        .find(({ grant }) => grant.granter === owner && grant.authorization.spend_limit.denom === denom)
        ?.drainingDeployments?.map(({ deployment }) => deployment) || []
    );
  });
  jest.spyOn(drainingDeploymentService, "calculateTopUpAmount").mockImplementation(async ({ blockRate }) => (blockRate * secondsInWeek) / 6);

  it("should top up draining deployment given owners have sufficient grants and balances", async () => {
    await topUpDeploymentsService.topUpDeployments({ dryRun: false });

    let uaktCount = 0;
    let usdtCount = 0;

    data.forEach(({ drainingDeployments, grant }) => {
      drainingDeployments.forEach(({ isExpectedToTopUp, deployment }) => {
        if (isExpectedToTopUp) {
          const isAkt = deployment.denom === "uakt";
          const client = isAkt ? uaktMasterSigningClient : usdtMasterSigningClient;
          uaktCount += isAkt ? 1 : 0;
          usdtCount += isAkt ? 0 : 1;

          expect(client.executeTx).toHaveBeenCalledWith(
            [
              {
                typeUrl: MsgExec.typeUrl,
                value: {
                  grantee: grant.grantee,
                  msgs: [
                    {
                      typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
                      value: expect.any(Buffer)
                    }
                  ]
                }
              }
            ],
            { fee: { granter: grant.granter } }
          );
        }
      });
    });

    expect(uaktMasterSigningClient.executeTx).toHaveBeenCalledTimes(uaktCount);
    expect(usdtMasterSigningClient.executeTx).toHaveBeenCalledTimes(usdtCount);
  });

  xdescribe("actual top up deployment tx on demand", () => {
    jest.setTimeout(30000);

    it("should top up or not depending on parameters below", async () => {
      const denom = "uakt";
      const owner = "<REPLACE_WITH_OWNER_ADDRESS>";
      const dseq = "<REPLACE_WITH_DEPLOYMENT_DSEQ_NUMBER>" as unknown as number;
      const wallet = container.resolve<Wallet>(UAKT_TOP_UP_MASTER_WALLET);
      const signer = new BatchSigningClientService(container.resolve(BILLING_CONFIG), wallet, container.resolve(TYPE_REGISTRY));
      const grantee = await wallet.getFirstAddress();

      try {
        const res = await signer.executeTx(
          [
            container.resolve(RpcMessageService).getExecDepositDeploymentMsg({
              dseq,
              amount: 1000000,
              denom,
              owner: owner,
              grantee
            })
          ],
          { fee: { granter: owner } }
        );
        console.log("DEBUG res", res);
      } catch (e) {
        console.log("DEBUG e", e);
      }
    });
  });
});
