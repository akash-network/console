import type { MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta3";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { mock } from "jest-mock-extended";
import Long from "long";

import type { AuthService } from "@src/auth/services/auth.service";
import { TrialDeploymentCreated } from "@src/billing/events/trial-deployment-created";
import type { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { DedupeSigningClientService } from "@src/billing/services/dedupe-signing-client/dedupe-signing-client.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { ManagedSignerService } from "./managed-signer.service";

import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(ManagedSignerService.name, () => {
  describe("executeDecodedTxByUserId", () => {
    it("throws 404 error when userId is null", async () => {
      const { service } = setup();

      await expect(service.executeDecodedTxByUserId(null as any, [])).rejects.toThrow("User Not Found");
    });

    it("throws 404 error when userId is undefined", async () => {
      const { service } = setup();

      await expect(service.executeDecodedTxByUserId(undefined as any, [])).rejects.toThrow("User Not Found");
    });

    it("throws 404 error when userWallet is not found", async () => {
      const { service, userWalletRepository, authService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(null)
      });

      await expect(service.executeDecodedTxByUserId("user-123", [])).rejects.toThrow("UserWallet Not Found");

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-123");
    });

    it("throws 404 error when user is not found", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123" });
      const { service, userRepository } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(null)
      });

      await expect(service.executeDecodedTxByUserId("user-456", [])).rejects.toThrow("User Not Found");

      expect(userRepository.findById).toHaveBeenCalledWith("user-456");
    });

    it("throws 403 error when userWallet has no fee allowance", async () => {
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 0 });
      const user = UserSeeder.create({ userId: "user-123" });
      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user)
      });

      await expect(service.executeDecodedTxByUserId("user-123", [])).rejects.toThrow("UserWallet has no fee allowance");
    });

    it("throws 403 error when userWallet has no deployment allowance for deployment message", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 0
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: "/akash.deployment.v1beta3.MsgCreateDeployment",
        value: {} as MsgCreateDeployment
      };

      const { service } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user)
      });

      await expect(service.executeDecodedTxByUserId("user-123", [deploymentMessage])).rejects.toThrow("UserWallet has no deployment allowance");
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
          typeUrl: "/akash.deployment.v1beta3.MsgCreateLease",
          value: {}
        }
      ];

      const { service, anonymousValidateService, featureFlagsService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        validateLeaseProviders: jest.fn().mockResolvedValue(undefined),
        validateTrialLimit: jest.fn().mockResolvedValue(undefined),
        executeManagedTx: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDecodedTxByUserId("user-123", messages);

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
          typeUrl: "/akash.deployment.v1beta3.MsgCreateLease",
          value: {}
        }
      ];

      const { service, anonymousValidateService, featureFlagsService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [],
        executeManagedTx: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDecodedTxByUserId("user-123", messages);

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
          typeUrl: "/akash.deployment.v1beta3.MsgCreateLease",
          value: {}
        }
      ];

      const txResult = {
        code: 0,
        hash: "tx-hash-123",
        rawLog: "success",
        transactionHash: "tx-hash-123"
      };

      const { service, dedupeSigningClientService, balancesService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        executeManagedTx: jest.fn().mockResolvedValue(txResult),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      const result = await service.executeDecodedTxByUserId("user-123", messages);

      expect(dedupeSigningClientService.executeManagedTx).toHaveBeenCalledWith(
        expect.any(String), // MASTER_WALLET_MNEMONIC
        wallet.id,
        messages,
        { fee: { granter: expect.any(String) } }
      );
      expect(balancesService.refreshUserWalletLimits).toHaveBeenCalledWith(wallet);
      expect(result).toEqual({
        code: 0,
        hash: "tx-hash-123",
        transactionHash: "tx-hash-123",
        rawLog: "success"
      });
    });

    it("publishes TrialDeploymentCreated event for trialing wallet with deployment message when anonymous trial is disabled", async () => {
      const wallet = UserWalletSeeder.create({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = UserSeeder.create({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: "/akash.deployment.v1beta3.MsgCreateDeployment",
        value: {
          id: {
            dseq: Long.fromNumber(123),
            owner: "akash1test"
          }
        } as MsgCreateDeployment
      };

      const { service, domainEvents } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [],
        executeManagedTx: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDecodedTxByUserId("user-123", [deploymentMessage]);

      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentCreated));
      const publishedEvent = (domainEvents.publish as jest.Mock).mock.calls[0][0] as TrialDeploymentCreated;
      expect(publishedEvent.data.walletId).toBe(wallet.id);
      expect(publishedEvent.data.dseq).toBe("123");
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
        typeUrl: "/akash.deployment.v1beta3.MsgCreateDeployment",
        value: {
          id: { dseq: BigInt(123) }
        } as any
      };

      const { service, domainEvents } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        enabledFeatures: [FeatureFlags.ANONYMOUS_FREE_TRIAL],
        executeManagedTx: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDecodedTxByUserId("user-123", [deploymentMessage]);

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
          typeUrl: "/akash.deployment.v1beta3.MsgCreateLease",
          value: {}
        }
      ];
      const chainError = new Error("Chain error");

      const { service, chainErrorService } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        findById: jest.fn().mockResolvedValue(user),
        executeManagedTx: jest.fn().mockRejectedValue(chainError),
        toAppError: jest.fn().mockResolvedValue(new Error("App error"))
      });

      await expect(service.executeDecodedTxByUserId("user-123", messages)).rejects.toThrow("App error");

      expect(chainErrorService.toAppError).toHaveBeenCalledWith(chainError, messages);
    });

    it("uses current user when userId matches auth currentUser", async () => {
      const currentUser = UserSeeder.create({ userId: "user-123" });
      const wallet = UserWalletSeeder.create({ userId: "user-123", feeAllowance: 100 });
      const messages: EncodeObject[] = [
        {
          typeUrl: "/akash.deployment.v1beta3.MsgCreateLease",
          value: {}
        }
      ];

      const { service, userRepository } = setup({
        findOneByUserId: jest.fn().mockResolvedValue(wallet),
        currentUser,
        executeManagedTx: jest.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: jest.fn().mockResolvedValue(undefined)
      });

      await service.executeDecodedTxByUserId("user-123", messages);

      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    findOneByUserId?: UserWalletRepository["findOneByUserId"];
    findById?: UserRepository["findById"];
    currentUser?: UserOutput;
    enabledFeatures?: FeatureFlagValue[];
    validateLeaseProviders?: TrialValidationService["validateLeaseProviders"];
    validateTrialLimit?: TrialValidationService["validateTrialLimit"];
    executeManagedTx?: DedupeSigningClientService["executeManagedTx"];
    refreshUserWalletLimits?: BalancesService["refreshUserWalletLimits"];
    publish?: DomainEventsService["publish"];
    toAppError?: ChainErrorService["toAppError"];
  }) {
    const mocks = {
      config: mock<BillingConfigService>({
        get: jest.fn().mockImplementation(
          (key: string) =>
            ({
              MASTER_WALLET_MNEMONIC: "audit ugly common mean place token hover dirt drive side rookie wheel"
            })[key]
        )
      }),
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
        toAppError: input?.toAppError ?? jest.fn()
      }),
      anonymousValidateService: mock<TrialValidationService>({
        validateLeaseProviders: input?.validateLeaseProviders ?? jest.fn(),
        validateTrialLimit: input?.validateTrialLimit ?? jest.fn()
      }),
      featureFlagsService: mock<FeatureFlagsService>({
        isEnabled: jest.fn().mockImplementation(flag => !!input?.enabledFeatures?.includes(flag))
      }),
      masterSigningClientService: mock<BatchSigningClientService>(),
      dedupeSigningClientService: mock<DedupeSigningClientService>({
        executeManagedTx: input?.executeManagedTx ?? jest.fn()
      }),
      domainEvents: mock<DomainEventsService>({
        publish: input?.publish ?? jest.fn()
      })
    };

    const service = new ManagedSignerService(
      mocks.config,
      {} as any, // registry - not used in this method
      mocks.userWalletRepository,
      mocks.userRepository,
      mocks.balancesService,
      mocks.authService,
      mocks.chainErrorService,
      mocks.anonymousValidateService,
      mocks.featureFlagsService,
      mocks.masterSigningClientService,
      mocks.dedupeSigningClientService,
      mocks.domainEvents
    );

    return { service, ...mocks };
  }
});
