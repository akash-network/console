import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import type { MongoAbility } from "@casl/ability";
import { createMongoAbility } from "@casl/ability";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { CreateLogger } from "@src/core";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { createAkashAddress } from "../../../../test/seeders";
import type { TxManagerService } from "../tx-manager/tx-manager.service";
import { ManagedSignerService } from "./managed-signer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

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
        findOneByUserId: vi.fn().mockResolvedValue(null)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [])).rejects.toThrow("UserWallet Not Found");

      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "sign");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-123");
    });

    it("throws 402 error when userWallet has no fee allowance", async () => {
      const user = createUser({ userId: "user-123" });
      const wallet = createUserWallet({ userId: "user-123", feeAllowance: 0 });
      const { service } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        retrieveAndCalcFeeLimit: vi.fn().mockResolvedValue(0)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [])).rejects.toThrow("Not enough funds to cover the transaction fee");
    });

    it("throws 402 error when userWallet has no deployment allowance for deployment message", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 0
      });
      const user = createUser({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateDeployment.$type,
        value: MsgCreateDeployment.fromPartial({})
      };

      const { service } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        retrieveDeploymentLimit: vi.fn().mockResolvedValue(0)
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage])).rejects.toThrow(
        "Not enough balance to cover the deployment deposit. Add credits or turn on auto recharge to continue."
      );
    });

    it("refuses a create whose deposit exceeds the deployment allowance instead of leaving it to chain simulation", async () => {
      const { service, walletReloadJobService, logger, txManagerService } = setupForCreate({ deploymentLimit: 400000 });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow(
        "Add credits or turn on auto recharge to continue."
      );

      expect(txManagerService.signAndBroadcastWithDerivedWallet).not.toHaveBeenCalled();
      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ userId: "user-123" }, { triggeredByDeployment: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DEPLOYMENT_CREATE_REFUSED_INSUFFICIENT_ALLOWANCE",
          deploymentAllowance: 400000,
          requiredDeposit: 500000,
          reloadScheduled: false
        })
      );
    });

    it("tells the user a top up is on the way when auto recharge covers the shortfall", async () => {
      const { service } = setupForCreate({ deploymentLimit: 400000, scheduleImmediate: vi.fn().mockResolvedValue(true) });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow(
        "A top up from your saved payment method is on the way, so try again in a moment."
      );
    });

    it("allows a create whose deposit the deployment allowance exactly covers", async () => {
      const { service, txManagerService } = setupForCreate({ deploymentLimit: 500000 });

      await service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)]);

      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalled();
    });

    it("ignores deposits denominated in another denom, which the chain rejects on its own", async () => {
      const { service, txManagerService } = setupForCreate({ deploymentLimit: 1 });

      await service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000, "uusdc")]);

      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalled();
    });

    it("refuses a batch where a negative deposit would otherwise offset a positive one", async () => {
      const { service, txManagerService } = setupForCreate({ deploymentLimit: 400000 });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000), createDeploymentMessage(-500000)])).rejects.toThrow(
        "Add credits or turn on auto recharge to continue."
      );

      expect(txManagerService.signAndBroadcastWithDerivedWallet).not.toHaveBeenCalled();
    });

    it("surfaces the 402 even when scheduling the reload fails", async () => {
      const { service, logger } = setupForCreate({
        deploymentLimit: 400000,
        scheduleImmediate: vi.fn().mockRejectedValue(new Error("Failed to schedule wallet balance reload check"))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow(
        "Add credits or turn on auto recharge to continue."
      );

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "INSUFFICIENT_BALANCE_RELOAD_SCHEDULE_FAILED", userId: "user-123" }));
    });

    it("schedules a reload when the chain refuses the broadcast for insufficient balance", async () => {
      const { service, walletReloadJobService } = setupForCreate({
        deploymentLimit: 500000,
        signAndBroadcastWithDerivedWallet: vi.fn().mockRejectedValue(new Error("deposit invalid: insufficient balance")),
        transformChainError: vi.fn().mockResolvedValue(createError(402, "Not enough balance to cover the deployment deposit."))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow(
        "Not enough balance to cover the deployment deposit."
      );

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ userId: "user-123" }, { triggeredByDeployment: true });
    });

    it("flags the reload as deployment triggered so a first create is not skipped for having no active deployment", async () => {
      const { service, walletReloadJobService } = setupForCreate({ deploymentLimit: 0 });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow(
        "Add credits or turn on auto recharge to continue."
      );

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith(expect.anything(), { triggeredByDeployment: true });
    });

    it("does not schedule a reload when the broadcast fails for a reason other than balance", async () => {
      const { service, walletReloadJobService } = setupForCreate({
        deploymentLimit: 500000,
        signAndBroadcastWithDerivedWallet: vi.fn().mockRejectedValue(new Error("bid not open")),
        transformChainError: vi.fn().mockResolvedValue(createError(400, "Cannot create lease"))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [createDeploymentMessage(500000)])).rejects.toThrow("Cannot create lease");

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("skips trial validation when anonymous free trial is disabled", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        enabledFeatures: [],
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProviders).not.toHaveBeenCalled();
    });

    it("executes transaction successfully and returns result", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue(txResult),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
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
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = createUser({ userId: "user-123" });
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

      const hasLeases = vi.fn();
      const { service, domainEvents } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        enabledFeatures: [],
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(undefined),
        hasLeases
      });

      hasLeases.mockResolvedValue(false);
      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);

      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentLeaseCreated));
      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(EnableDeploymentAlertCommand));
      const publishCalls = vi.mocked(domainEvents.publish).mock.calls;
      const trialEvent = publishCalls.find(([e]) => e instanceof TrialDeploymentLeaseCreated)?.[0] as TrialDeploymentLeaseCreated;
      expect(trialEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: true
      });

      hasLeases.mockResolvedValue(true);
      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);
      expect(domainEvents.publish).toHaveBeenCalledWith(expect.any(TrialDeploymentLeaseCreated));
      const allCalls = vi.mocked(domainEvents.publish).mock.calls;
      const trialEvents = allCalls.filter(([e]) => e instanceof TrialDeploymentLeaseCreated).map(([e]) => e as TrialDeploymentLeaseCreated);
      const anotherTrialEvent = trialEvents[trialEvents.length - 1];
      expect(anotherTrialEvent.data).toEqual({
        walletId: wallet.id,
        dseq: "123",
        createdAt: expect.any(String),
        isFirstLease: false
      });
    });

    it("publishes FundDeploymentCommand with a singleton key when a non-trialing wallet creates a lease", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: false
      });
      const user = createUser({ userId: "user-123" });
      const leaseMessage: EncodeObject = {
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

      const { service, domainEvents } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", [leaseMessage]);

      const fundCall = vi.mocked(domainEvents.publish).mock.calls.find(([event]) => event instanceof FundDeploymentCommand);
      const [fundCommand, options] = fundCall as [FundDeploymentCommand, { singletonKey: string }];
      expect(fundCommand.data).toEqual({
        walletId: wallet.id,
        address: wallet.address,
        dseq: "123"
      });
      expect(options).toEqual({ singletonKey: `FundDeploymentCommand.123.${wallet.id}` });
    });

    it("does not publish FundDeploymentCommand when a trialing wallet creates a lease", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = createUser({ userId: "user-123" });
      const leaseMessage: EncodeObject = {
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

      const { service, domainEvents } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", [leaseMessage]);

      expect(domainEvents.publish).not.toHaveBeenCalledWith(expect.any(FundDeploymentCommand), expect.anything());
    });

    it("does not publish FundDeploymentCommand for transactions without a lease message", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: false
      });
      const user = createUser({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateDeployment.$type,
        value: MsgCreateDeployment.fromPartial({})
      };

      const { service, domainEvents } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage]);

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });

    it("throws and skips side-effects when the broadcast tx lands on-chain with a non-zero code", async () => {
      const wallet = createUserWallet({ userId: "user-123", feeAllowance: 100, deploymentAllowance: 100, isTrialing: true });
      const user = createUser({ userId: "user-123" });
      const deploymentMessage: EncodeObject = {
        typeUrl: MsgCreateLease.$type,
        value: MsgCreateLease.fromPartial({
          bidId: { dseq: 123, owner: "akash1test", gseq: 1, oseq: 1, provider: "akash1test" }
        })
      };

      const { service, domainEvents, balancesService, walletReloadJobService, chainErrorService } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 17,
          hash: "tx-hash",
          rawLog: "deployment exists"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        transformChainError: vi.fn().mockResolvedValue(new Error("Deployment with provided dseq and owner already exists"))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", [deploymentMessage])).rejects.toThrow("Deployment with provided dseq");

      expect(chainErrorService.toAppError).toHaveBeenCalledWith(expect.objectContaining({ message: "deployment exists" }), [deploymentMessage]);
      expect(domainEvents.publish).not.toHaveBeenCalled();
      expect(balancesService.refreshUserWalletLimits).not.toHaveBeenCalled();
      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("handles chain errors properly", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockRejectedValue(chainError),
        transformChainError: vi.fn().mockResolvedValue(new Error("App error"))
      });

      await expect(service.executeDerivedDecodedTxByUserId("user-123", messages)).rejects.toThrow("App error");

      expect(chainErrorService.toAppError).toHaveBeenCalledWith(chainError, messages);
    });

    it("uses current user when userId matches auth currentUser", async () => {
      const currentUser = createUser({ userId: "user-123" });
      const wallet = createUserWallet({ userId: "user-123", feeAllowance: 100 });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        currentUser,
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("validates lease provider for all leases regardless of trial status", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: false
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        validateLeaseProvidersAuditors: vi.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProvidersAuditors).toHaveBeenCalledWith(messages, wallet);
    });

    it("validates lease provider for trial wallets", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        validateLeaseProvidersAuditors: vi.fn().mockResolvedValue(undefined),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateLeaseProvidersAuditors).toHaveBeenCalledWith(messages, wallet);
    });

    it("validates deployment gpu interconnect for the wallet", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100,
        isTrialing: true
      });
      const user = createUser({ userId: "user-123" });
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
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(anonymousValidateService.validateDeploymentGpuInterconnect).toHaveBeenCalledWith(messages, wallet);
    });
  });

  describe("executeDerivedEncodedTxByUserId", () => {
    it("executes transaction and calls scheduleImmediate when transaction contains MsgCreateDeployment", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
      const deploymentMessage = {
        typeUrl: MsgCreateDeployment.$type,
        value: Buffer.from(JSON.stringify({ id: { dseq: "123", owner: wallet.address } })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        decode: vi.fn().mockReturnValue({ id: { dseq: "123", owner: wallet.address } })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [deploymentMessage]);

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ userId: "user-123" });
    });

    it("executes transaction and calls scheduleImmediate when transaction contains MsgAccountDeposit", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
      const depositMessage = {
        typeUrl: MsgAccountDeposit.$type,
        value: Buffer.from(JSON.stringify({ owner: wallet.address, amount: "1000" })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        decode: vi.fn().mockReturnValue({ owner: wallet.address, amount: "1000" })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [depositMessage]);

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ userId: "user-123" });
    });

    it("executes transaction and does not call scheduleImmediate when transaction does not contain spending messages", async () => {
      const wallet = createUserWallet({
        userId: "user-123",
        feeAllowance: 100,
        deploymentAllowance: 100
      });
      const user = createUser({ userId: "user-123" });
      const leaseMessage = {
        typeUrl: MsgCreateLease.$type,
        value: Buffer.from(JSON.stringify({ bidId: { dseq: "123" } })).toString("base64")
      };

      const { service, walletReloadJobService } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "tx-hash",
          rawLog: "success"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined),
        decode: vi.fn().mockReturnValue({ bidId: { dseq: "123" } })
      });

      await service.executeDerivedEncodedTxByUserId("user-123", [leaseMessage]);

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("delegates spend-time activation to the guard and surfaces its retriable 409", async () => {
      const wallet = createUserWallet({ userId: "user-123", activatedAt: null });
      const user = createUser({ userId: "user-123" });
      const deploymentMessage = {
        typeUrl: MsgCreateDeployment.$type,
        value: Buffer.from(JSON.stringify({ id: { dseq: "123", owner: wallet.address } })).toString("base64")
      };

      const { service, trialActivationJobService, txManagerService } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        decode: vi.fn().mockReturnValue({ id: { dseq: "123", owner: wallet.address } })
      });
      trialActivationJobService.assertActivated.mockRejectedValue(createError(409, "provisioning", { errorCode: "wallet_provisioning" }));

      await expect(service.executeDerivedEncodedTxByUserId("user-123", [deploymentMessage])).rejects.toMatchObject({
        status: 409,
        errorCode: "wallet_provisioning"
      });
      expect(trialActivationJobService.assertActivated).toHaveBeenCalledWith(wallet);
      expect(txManagerService.signAndBroadcastWithDerivedWallet).not.toHaveBeenCalled();
    });

    it("throws 400 with message index and typeUrl when a message fails to decode", async () => {
      const decodeError = new Error("illegal tag: field no 0 wire type 7");
      const badMessage = {
        typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment",
        value: Buffer.from("not a real proto").toString("base64")
      };

      const { service, logger } = setup({
        decode: vi.fn().mockImplementation(() => {
          throw decodeError;
        })
      });

      await expect(service.executeDerivedEncodedTxByUserId("user-123", [badMessage])).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("/akash.deployment.v1beta4.MsgCreateDeployment")
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TX_MESSAGE_DECODE_FAILED",
          index: 0,
          typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment",
          error: decodeError
        })
      );
    });
  });

  describe("executeFundingTx", () => {
    it("signs and broadcasts with funding wallet", async () => {
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateDeployment.$type, value: MsgCreateDeployment.fromPartial({}) }];
      const txResult = { code: 0, hash: "tx-hash", rawLog: "success" };

      const { service, txManagerService } = setup({
        signAndBroadcastWithFundingWallet: vi.fn().mockResolvedValue(txResult)
      });

      const result = await service.executeFundingTx(messages);

      expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(messages);
      expect(result).toEqual(txResult);
    });

    it("throws app error when chain call fails", async () => {
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateDeployment.$type, value: MsgCreateDeployment.fromPartial({}) }];
      const chainError = new Error("Chain funding error");

      const { service, chainErrorService } = setup({
        signAndBroadcastWithFundingWallet: vi.fn().mockRejectedValue(chainError),
        transformChainError: vi.fn().mockResolvedValue(new Error("Funding app error"))
      });

      await expect(service.executeFundingTx(messages)).rejects.toThrow("Funding app error");
      expect(chainErrorService.toAppError).toHaveBeenCalledWith(chainError, messages);
    });
  });

  describe("executeDerivedDecodedTxByUserId - result without hash", () => {
    it("returns result as-is when hash is empty", async () => {
      const user = createUser({ userId: "user-123" });
      const wallet = createUserWallet({ userId: "user-123", feeAllowance: 100, deploymentAllowance: 100 });
      const messages: EncodeObject[] = [{ typeUrl: MsgCreateLease.$type, value: MsgCreateLease.fromPartial({ bidId: { dseq: 123 } }) }];

      const { service } = setup({
        findOneByUserId: vi.fn().mockResolvedValue(wallet),
        findById: vi.fn().mockResolvedValue(user),
        signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({
          code: 0,
          hash: "",
          rawLog: "empty hash"
        }),
        refreshUserWalletLimits: vi.fn().mockResolvedValue(undefined)
      });

      const result = await service.executeDerivedDecodedTxByUserId("user-123", messages);

      expect(result).toEqual({ code: 0, hash: "", rawLog: "empty hash" });
    });
  });

  function createDeploymentMessage(depositAmount: number, denom = "uakt"): EncodeObject {
    return {
      typeUrl: MsgCreateDeployment.$type,
      value: MsgCreateDeployment.fromPartial({ deposit: { amount: { denom, amount: depositAmount.toString() } } })
    };
  }

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ManagedSignerService.name });
  });

  function setupForCreate(input: { deploymentLimit: number } & Omit<NonNullable<Parameters<typeof setup>[0]>, "retrieveDeploymentLimit">) {
    const { deploymentLimit, ...rest } = input;

    return setup({
      findOneByUserId: vi.fn().mockResolvedValue(createUserWallet({ userId: "user-123", feeAllowance: 100, deploymentAllowance: deploymentLimit })),
      findById: vi.fn().mockResolvedValue(createUser({ userId: "user-123" })),
      retrieveDeploymentLimit: vi.fn().mockResolvedValue(deploymentLimit),
      signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({ code: 0, hash: "TESTHASH", rawLog: "[]" }),
      refreshUserWalletLimits: vi.fn(),
      ...rest
    });
  }

  function setup(input?: {
    findOneByUserId?: UserWalletRepository["findOneByUserId"];
    findById?: UserRepository["findById"];
    currentUser?: UserOutput;
    enabledFeatures?: FeatureFlagValue[];
    validateLeaseProviders?: TrialValidationService["validateLeaseProviders"];
    validateLeaseProvidersAuditors?: TrialValidationService["validateLeaseProvidersAuditors"];
    signAndBroadcastWithDerivedWallet?: TxManagerService["signAndBroadcastWithDerivedWallet"];
    signAndBroadcastWithFundingWallet?: TxManagerService["signAndBroadcastWithFundingWallet"];
    refreshUserWalletLimits?: BalancesService["refreshUserWalletLimits"];
    retrieveAndCalcFeeLimit?: BalancesService["retrieveAndCalcFeeLimit"];
    retrieveDeploymentLimit?: BalancesService["retrieveDeploymentLimit"];
    publish?: DomainEventsService["publish"];
    transformChainError?: ChainErrorService["toAppError"];
    hasLeases?: LeaseHttpService["hasLeases"];
    scheduleImmediate?: WalletReloadJobService["scheduleImmediate"];
    decode?: Registry["decode"];
  }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        accessibleBy: vi.fn().mockReturnThis(),
        findOneByUserId: input?.findOneByUserId ?? vi.fn()
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findById ?? vi.fn()
      }),
      balancesService: mock<BalancesService>({
        refreshUserWalletLimits: input?.refreshUserWalletLimits ?? vi.fn(),
        retrieveAndCalcFeeLimit: input?.retrieveAndCalcFeeLimit ?? vi.fn().mockResolvedValue(1000000),
        retrieveDeploymentLimit: input?.retrieveDeploymentLimit ?? vi.fn().mockResolvedValue(5000000)
      }),
      authService: mock<AuthService>({
        currentUser: input?.currentUser ?? createUser({ userId: "current-user" }),
        ability: createMongoAbility<MongoAbility>()
      }),
      chainErrorService: mock<ChainErrorService>({
        toAppError: input?.transformChainError ?? vi.fn(async e => e)
      }),
      anonymousValidateService: mock<TrialValidationService>({
        validateLeaseProvidersAuditors: input?.validateLeaseProvidersAuditors ?? vi.fn()
      }),
      txManagerService: mock<TxManagerService>({
        signAndBroadcastWithDerivedWallet: input?.signAndBroadcastWithDerivedWallet ?? vi.fn(),
        signAndBroadcastWithFundingWallet: input?.signAndBroadcastWithFundingWallet ?? vi.fn(),
        getFundingWalletAddress: vi.fn().mockResolvedValue(createAkashAddress())
      }),
      domainEvents: mock<DomainEventsService>({
        publish: input?.publish ?? vi.fn()
      }),
      leaseHttpService: mock<LeaseHttpService>({
        hasLeases: input?.hasLeases ?? vi.fn(async () => false)
      }),
      walletReloadJobService: mock<WalletReloadJobService>({
        scheduleImmediate: input?.scheduleImmediate ?? vi.fn().mockResolvedValue(false)
      }),
      billingConfigService: mockConfigService<BillingConfigService>({
        DEPLOYMENT_GRANT_DENOM: "uakt",
        FEE_ALLOWANCE_REFILL_AMOUNT: 1000000,
        FEE_ALLOWANCE_REFILL_THRESHOLD: 100000,
        TRIAL_ALLOWANCE_EXPIRATION_DAYS: 30
      }),
      managedUserWalletService: mock<ManagedUserWalletService>({
        refillWalletFees: vi.fn()
      }),
      trialActivationJobService: mock<TrialActivationJobService>(),
      logger: mock<ReturnType<CreateLogger>>({
        error: vi.fn(),
        warn: vi.fn()
      })
    };

    const registryMock = mock<Registry>({
      decode: input?.decode ?? vi.fn()
    });

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

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
      mocks.managedUserWalletService,
      mocks.trialActivationJobService,
      createLogger
    );

    return { service, registry: registryMock, createLogger, ...mocks };
  }
});
