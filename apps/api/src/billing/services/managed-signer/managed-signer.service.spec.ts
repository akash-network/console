import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { createAkashAddress } from "../../../../test/seeders";
import type { TxManagerService } from "../tx-manager/tx-manager.service";
import { ManagedSignerService } from "./managed-signer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(ManagedSignerService.name, () => {
  describe("executeDerivedDecodedTxByUserId", () => {
    it("throws 404 error when userId is null", async () => {
      const { service } = setup();

      await expect(service.executeDerivedDecodedTxByUserId(null as any, [])).rejects.toThrow("User Not Found");
    });

    it("throws 404 error when userId is undefined", async () => {
      const { service } = setup();

      await expect(service.executeDerivedDecodedTxByUserId(undefined as any, [])).rejects.toThrow("User Not Found");
    });

    it("throws 404 error when userWallet is not found", async () => {
      const { service, userWalletRepository, authService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(null)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [])).rejects.toThrow("UserWallet Not Found");

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-123");
    });

    it("throws 402 error when userWallet has no fee allowance", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 0 });
      const user = UserSeeder.create({ userId: "user-123" });
      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        retrieveAndCalcFeeLimit: jest.fn().mockResolvedValue(0)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [])).rejects.toThrow("Not enough funds to cover the transaction fee");
    });

    it("throws 402 error when userWallet has no deployment allowance for deployment message", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 0
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateDeployment.$type,
        value: MsgCreateDeployment.fromPartial({})
      };

      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        retrieveDeploymentLimit: jest.fn().mockResolvedValue(0)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage])).rejects.toThrow("Not enough funds to cover the deployment costs");
    });

    it("skips trial validation when anonymous free trial is disabled", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123
            }
          })
        }
      ];

      const { service, anonymousValidateService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [],
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProviders).not.toHaveBeenCalled();
      expect(anonymousValidateService.validateTrialLimit).not.toHaveBeenCalled();
    });

    it("executes transaction successfully and returns result", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123
            }
          })
        }
      ];

      const txResult = {
        code: 0,
        hash: "tx-hash-123",
        rawLog: "success",
        transactionHash: "tx-hash-123"
      };

      const { service, txManagerService, balancesService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue(txResult),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      const result = await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(wallet.id, messages, { fee: { granter: expect.any(String) } });
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        code: 0,
        hash: "tx-hash-123",
        transactionHash: "tx-hash-123",
        rawLog: "success"
      });
    });

    it("publishes TrialDeploymentLeaseCreated event for trialing wallet with deployment message when anonymous trial is disabled", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateLease.$type,
        value: MsgCreateLease.fromPartial({
          bidId: {
            dseq: 123,
            owner: "akash1test",
            gseq: 1,
            oseq: 1,
            provider: "akash1test"
          }
        })
      };

      const hasLeases = jest.fn();
      const { service, domainEvents } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [],
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined),
        hasLeases
      });

      hasLeases.mockResolvedValue(false);
      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);

      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentLeaseCreated));
      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(EnableDeploymentAlertCommand));
      const publishCalls = (domainEvents.publish as jest.Mock).mock.calls;
      const trialEvent = publishCalls.find(([e]: [unknown]) => e instanceof TrialDeploymentLeaseCreated)?.[0] as TrialDeploymentLeaseCreated;
      expect(trialEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: true
      });

      hasLeases.mockResolvedValue(true);
      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);
      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentLeaseCreated));
      const allCalls = (domainEvents.publish as jest.Mock).mock.calls;
      const trialEvents = allCalls
        .filter(([e]: [unknown]) => e instanceof TrialDeploymentLeaseCreated)
        .map(([e]: [unknown]) => e as TrialDeploymentLeaseCreated);
      const anotherTrialEvent = trialEvents[trialEvents.length - 1];
      expect(anotherTrialEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: false
      });
    });

    it("handles chain errors properly", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123
            }
          })
        }
      ];
      const chainError = new Error("Chain test error");

      const { service, chainErrorService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockRejectedValue(chainError),
        transformChainError: jest.fn().mockResolvedValue(new Error("App error"))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", messages)).rejects.toThrow("App error");

      expect(chainErrorService.toAppError).toHaveBeenCalledWith(chainError, messages);
    });

    it("uses current user when userId matches auth currentUser", async () => {
      const currentUser = UserSeeder.create({ userId: "user-123" });
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 100 });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123
            }
          })
        }
      ];

      const { service, userRepository } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        currentUser,
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("validates lease provider for all leases regardless of trial status", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: false
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123,
              provider: "akash1provider"
            }
          })
        }
      ];

      const { service, anonymousValidateService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        validateLeaseProvidersAuditors: jest.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProvidersAuditors).toHaveBeenCalledWith(messages, wallet);
    });

    it("validates lease provider for trial wallets", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [
        {
          typeUrl: MsgCreateLease.$type,
          value: MsgCreateLease.fromPartial({
            bidId: {
              dseq: 123,
              provider: "akash1provider"
            }
          })
        }
      ];

      const { service, anonymousValidateService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        validateLeaseProvidersAuditors: jest.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProvidersAuditors).toHaveBeenCalledWith(messages, wallet);
    });
  });

  describe("executeDerivedEncodedTxByUserId", () => {
    it("executes transaction and calls scheduleImmediate when transaction contains MsgCreateDeployment", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage = {
        typeUrl: MsgCreateDeployment.$type,
        value: Buffer.from(JSON.stringify({ id: { dseq: "123", owner: wallet.address } })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        decode: jest.fn().mockReturnValue({ id: { dseq: "123", owner: wallet.address } })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [deploymentMessage]);

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith("user-123");
    });

    it("executes transaction and calls scheduleImmediate when transaction contains MsgAccountDeposit", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const depositMessage = {
        typeUrl: MsgAccountDeposit.$type,
        value: Buffer.from(JSON.stringify({ owner: wallet.address, amount: "1000" })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        decode: jest.fn().mockReturnValue({ owner: wallet.address, amount: "1000" })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [depositMessage]);

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith("user-123");
    });

    it("executes transaction and does not call scheduleImmediate when transaction does not contain spending messages", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const leaseMessage = {
        typeUrl: MsgCreateLease.$type,
        value: Buffer.from(JSON.stringify({ bidId: { dseq: "123" } })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        decode: jest.fn().mockReturnValue({ bidId: { dseq: "123" } })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [leaseMessage]);

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });
  });

  describe("executeFundingTx", () => {
    it("signs and broadcasts with funding wallet", async () => {
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateDeployment.$type, value: MsgCreateDeployment.fromPartial({}) }];
      const txResult = { code: 0, hash: "tx-hash", rawLog: "success" };

      const { service, txManagerService } = setup({
        signAndBroadcastWithFundingWallet: jest.fn().mockResolvedValue(txResult)
      });

      const result = await service.executeFundingTx(messages);

      expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages);
      expect(result).toEqual(txResult);
    });

    it("throws app error when chain call fails", async () => {
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateDeployment.$type, value: MsgCreateDeployment.fromPartial({}) }];
      const chainError = new Error("Chain funding error");

      const { service, chainErrorService } = setup({
        signAndBroadcastWithFundingWallet: jest.fn().mockRejectedValue(chainError),
        transformChainError: jest.fn().mockResolvedValue(new Error("Funding app error"))
      });

      await expect(service.executeFundingTx(messages)).rejects.toThrow("Funding app error");
      expect(chainErrorService.toAppError).toHaveBeenCalledWith(chainError, messages);
    });
  });

  describe("executeDerivedDecodedTxByUserId - result without hash", () => {
    it("returns result as-is when hash is empty", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 100, deploymentAllowance: 100 });
      const user = UserSeeder.create({ userId: "user-123" });
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateLease.$type, value: MsgCreateLease.fromPartial({ bidId: { dseq: 123 } }) }];

      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "",
          rawLog: "empty hash"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      const result = await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(result).toEqual({ code: 0, hash: "", rawLog: "empty hash" });
    });
  });

  function setup(input?: {
    findOneByUserId?: UserWalletRepository["findOneByUserId"];
    findById?: UserRepository["findById"];
    currentUser?: UserOutput;
    enabledFeatures?: FeatureFlagValue[];
    validateLeaseProviders?: TrialValidationService["validateLeaseProviders"];
    validateTrialLimit?: TrialValidationService["validateTrialLimit"];
    validateLeaseProvidersAuditors?: TrialValidationService["validateLeaseProvidersAuditors"];
    signAndBroadcastWithDerivedWallet?: TxManagerService["signAndBroadcastWithDerivedWallet"];
    signAndBroadcastWithFundingWallet?: TxManagerService["signAndBroadcastWithFundingWallet"];
    refreshUserWalletLimits?: BalancesService["refreshUserWalletLimits"];
    retrieveAndCalcFeeLimit?: BalancesService["retrieveAndCalcFeeLimit"];
    retrieveDeploymentLimit?: BalancesService["retrieveDeploymentLimit"];
    publish?: DomainEventsService["publish"];
    transformChainError?: ChainErrorService["toAppError"];
    hasLeases?: LeaseHttpService["hasLeases"];
    decode?: Registry["decode"];
  }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        accessibleBy: jest.fn().mockReturnThis(),
        findOneByUserId: input?.findOneByUserId ?? jest.fn()
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findById ?? jest.fn()
      }),
      balancesService: mock<BalancesService>({
        refreshUserWalletLimits: input?.refreshUserWalletLimits ?? jest.fn(),
        retrieveAndCalcFeeLimit: input?.retrieveAndCalcFeeLimit ?? jest.fn().mockResolvedValue(1000000),
        retrieveDeploymentLimit: input?.retrieveDeploymentLimit ?? jest.fn().mockResolvedValue(5000000)
      }),
      authService: mock<AuthService>({
        currentUser: input?.currentUser ?? UserSeeder.create({ userId: "current-user" }),
        ability: createMongoAbility<MongoAbility>()
      }),
      chainErrorService: mock<ChainErrorService>({
        toAppError: input?.transformChainError ?? jest.fn(async e => e)
      }),
      anonymousValidateService: mock<TrialValidationService>({
        validateLeaseProvidersAuditors: input?.validateLeaseProvidersAuditors ?? jest.fn()
      }),
      txManagerService: mock<TxManagerService>({
        signAndBroadcastWithDerivedWallet: input?.signAndBroadcastWithDerivedWallet ?? jest.fn(),
        signAndBroadcastWithFundingWallet: input?.signAndBroadcastWithFundingWallet ?? jest.fn(),
        getFundingWalletAddress: jest.fn().mockResolvedValue(createAkashAddress())
      }),
      domainEvents: mock<DomainEventsService>({
        publish: input?.publish ?? jest.fn()
      }),
      leaseHttpService: mock<LeaseHttpService>({
        hasLeases: input?.hasLeases ?? jest.fn(async () => false)
      }),
      walletReloadJobService: mock<WalletReloadJobService>({
        scheduleImmediate: jest.fn()
      }),
      billingConfigService: mockConfigService<BillingConfigService>({
        FEE_ALLOWANCE_REFILL_AMOUNT: 1000000,
        FEE_ALLOWANCE_REFILL_THRESHOLD: 100000,
        TRIAL_ALLOWANCE_EXPIRATION_DAYS: 30
      }),
      managedUserWalletService: mock<ManagedUserWalletService>({
        refillWalletFees: jest.fn()
      })
    };

    const registryMock = mock<Registry>({
      decode: input?.decode ?? jest.fn()
    });

    const service = new ManagedSignerService(
      registryMock,
      mocks.billingConfigService,
      mocks.userWalletRepository,
      mocks.userRepository,
      mocks.balancesService,
      mocks.authService,
      mocks.chainErrorService,
      mocks.anonymousValidateService,
      mocks.txManagerService,
      mocks.domainEvents,
      mocks.leaseHttpService,
      mocks.walletReloadJobService,
      mocks.managedUserWalletService
    );

    return { service, registry: registryMock, ...mocks };
  }
});
