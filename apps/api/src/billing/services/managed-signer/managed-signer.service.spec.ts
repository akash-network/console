import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { mock } from "jest-mock-extended";
import Long from "long";

import type { AuthService } from "@src/auth/services/auth.service";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { createAkashAddress } from "../../../../test/seeders";
import type { TxManagerService } from "../tx-manager/tx-manager.service";
import { ManagedSignerService } from "./managed-signer.service";

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

    it("throws 404 error when user is not found", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123" });
      const { service, userRepository } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(null)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-456", [])).rejects.toThrow("User Not Found");

      expect(userRepository.findById).toHaveBeenCalledWith("user-456");
    });

    it("throws 403 error when userWallet has no fee allowance", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 0 });
      const user = UserSeeder.create({ userId: "user-123" });
      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [])).rejects.toThrow("Not enough funds to cover the transaction fee");
    });

    it("throws 403 error when userWallet has no deployment allowance for deployment message", async () => {
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
        findById: jest.fn().mockResolvedValue(user)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage])).rejects.toThrow("Not enough funds to cover the deployment costs");
    });

    it("validates trial limits when anonymous free trial is enabled", async () => {
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
              dseq: Long.fromNumber(123)
            }
          })
        }
      ];

      const { service, anonymousValidateService, featureFlagsService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        validateLeaseProviders: jest.fn().mockResolvedValue(undefined),
        validateTrialLimit: jest.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ANONYMOUS_FREE_TRIAL);
      expect(anonymousValidateService.validateLeaseProviders).toHaveBeenCalledWith(messages[0], wallet, user);
      expect(anonymousValidateService.validateTrialLimit).toHaveBeenCalledWith(messages[0], wallet);
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
              dseq: Long.fromNumber(123)
            }
          })
        }
      ];

      const { service, anonymousValidateService, featureFlagsService } = setup({
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

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ANONYMOUS_FREE_TRIAL);
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
              dseq: Long.fromNumber(123)
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

      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(wallet.id, messages, { fee: { granter: expect.any(String) } }, false);
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
            dseq: Long.fromNumber(123),
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
      const publishedEvent = (domainEvents.publish as jest.Mock).mock.lastCall?.[0] as TrialDeploymentLeaseCreated;
      expect(publishedEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: true
      });

      hasLeases.mockResolvedValue(true);
      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);
      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentLeaseCreated));
      const anotherPublishedEvent = (domainEvents.publish as jest.Mock).mock.lastCall?.[0] as TrialDeploymentLeaseCreated;
      expect(anotherPublishedEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: false
      });
    });

    it("does not publish TrialDeploymentCreated event when anonymous trial is enabled", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateDeployment.$type,
        value: {
          id: {
            dseq: Long.fromNumber(123),
            owner: wallet.address
          }
        }
      };

      const { service, domainEvents } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);

      expect(domainEvents.publish).not.toHaveBeenCalled();
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
              dseq: Long.fromNumber(123)
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
              dseq: Long.fromNumber(123)
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
              dseq: Long.fromNumber(123),
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
              dseq: Long.fromNumber(123),
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

    it("validates lease provider in anonymous trial mode", async () => {
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
              dseq: Long.fromNumber(123),
              provider: "akash1provider"
            }
          })
        }
      ];

      const { service, anonymousValidateService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        validateLeaseProvidersAuditors: jest.fn().mockResolvedValue(undefined),
        validateLeaseProviders: jest.fn().mockResolvedValue(undefined),
        validateTrialLimit: jest.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProvidersAuditors).toHaveBeenCalledWith(messages, wallet);
      expect(anonymousValidateService.validateLeaseProviders).toHaveBeenCalledWith(messages[0], wallet, user);
      expect(anonymousValidateService.validateTrialLimit).toHaveBeenCalledWith(messages[0], wallet);
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

  function setup(input?: {
    findOneByUserId?: UserWalletRepository["findOneByUserId"];
    findById?: UserRepository["findById"];
    currentUser?: UserOutput;
    enabledFeatures?: FeatureFlagValue[];
    validateLeaseProviders?: TrialValidationService["validateLeaseProviders"];
    validateTrialLimit?: TrialValidationService["validateTrialLimit"];
    validateLeaseProvidersAuditors?: TrialValidationService["validateLeaseProvidersAuditors"];
    signAndBroadcastWithDerivedWallet?: TxManagerService["signAndBroadcastWithDerivedWallet"];
    refreshUserWalletLimits?: BalancesService["refreshUserWalletLimits"];
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
        refreshUserWalletLimits: input?.refreshUserWalletLimits ?? jest.fn()
      }),
      authService: mock<AuthService>({
        currentUser: input?.currentUser ?? UserSeeder.create({ userId: "current-user" }),
        ability: createMongoAbility<MongoAbility>()
      }),
      chainErrorService: mock<ChainErrorService>({
        toAppError: input?.transformChainError ?? jest.fn(async e => e)
      }),
      anonymousValidateService: mock<TrialValidationService>({
        validateLeaseProviders: input?.validateLeaseProviders ?? jest.fn(),
        validateTrialLimit: input?.validateTrialLimit ?? jest.fn(),
        validateLeaseProvidersAuditors: input?.validateLeaseProvidersAuditors ?? jest.fn()
      }),
      featureFlagsService: mock<FeatureFlagsService>({
        isEnabled: jest.fn().mockImplementation(flag => !!input?.enabledFeatures?.includes(flag))
      }),
      txManagerService: mock<TxManagerService>({
        signAndBroadcastWithDerivedWallet: input?.signAndBroadcastWithDerivedWallet ?? jest.fn(),
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
      })
    };

    const registryMock = mock<Registry>({
      decode: input?.decode ?? jest.fn()
    });

    const service = new ManagedSignerService(
      registryMock,
      mocks.userWalletRepository,
      mocks.userRepository,
      mocks.balancesService,
      mocks.authService,
      mocks.chainErrorService,
      mocks.anonymousValidateService,
      mocks.featureFlagsService,
      mocks.txManagerService,
      mocks.domainEvents,
      mocks.leaseHttpService,
      mocks.walletReloadJobService
    );

    return { service, registry: registryMock, ...mocks };
  }
});
