import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";
import { CachedBalance, type CachedBalanceService } from "@src/deployment/services/cached-balance/cached-balance.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { InitialDeploymentFundingService } from "./initial-deployment-funding.service";
import type { InitialDeploymentFundingInstrumentationService } from "./initial-deployment-funding-instrumentation.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(InitialDeploymentFundingService.name, () => {
  const CURRENT_HEIGHT = 1000;
  const LOOK_AHEAD_HEIGHT = CURRENT_HEIGHT + 600 * 24;

  it("throws when the lease is not visible on chain yet", async () => {
    const { service, drainingDeploymentService, managedSignerService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([]);

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow("not visible on chain yet");

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
  });

  it("skips funding when the deployment is closed", async () => {
    const { service, drainingDeploymentService, managedSignerService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment({ closedHeight: 900 })]);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("deployment_closed", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
  });

  it("skips funding when the deployment already has more runway than the look-ahead window", async () => {
    const { service, drainingDeploymentService, managedSignerService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment({ predictedClosedHeight: LOOK_AHEAD_HEIGHT + 1 })]);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("sufficient_runway", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
  });

  it("deposits the calculated top-up amount and schedules a wallet reload", async () => {
    const { service, drainingDeploymentService, rpcMessageService, managedSignerService, walletReloadJobService, instrumentation } = setup();
    const depositMessage = { typeUrl: "/akash.escrow.v1.MsgAccountDeposit", value: {} };
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    rpcMessageService.getDepositDeploymentMsg.mockReturnValue(depositMessage as ReturnType<RpcMessageService["getDepositDeploymentMsg"]>);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith({
      dseq: 123,
      amount: 500000,
      denom: "uakt",
      owner: "akash1owner",
      signer: "akash1owner"
    });
    expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(1, [depositMessage]);
    expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ walletId: 1 }, { triggeredByDeployment: true });
    expect(instrumentation.recordDeposit).toHaveBeenCalledWith(500000, "uakt", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
  });

  it("sizes the deposit to the target runway from the same height as the look-ahead check", async () => {
    const { service, drainingDeploymentService, blockHttpService } = setup();
    const deployment = createDrainingDeployment();
    drainingDeploymentService.findLeases.mockResolvedValue([deployment]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(drainingDeploymentService.calculateAmountToTargetRunway).toHaveBeenCalledWith({ ...deployment, runtimeEndsAt: null }, CURRENT_HEIGHT);
    expect(blockHttpService.getCurrentHeight).toHaveBeenCalledTimes(1);
  });

  it("deposits only the gap up to the target for a partially funded deployment", async () => {
    const { service, drainingDeploymentService, rpcMessageService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(720000);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 720000 }));
  });

  it("records the deposit and tolerates a wallet reload scheduling failure without failing the job", async () => {
    const { service, drainingDeploymentService, managedSignerService, walletReloadJobService, instrumentation, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 0, hash: "TESTHASH", rawLog: "[]" });
    walletReloadJobService.scheduleImmediate.mockRejectedValue(new Error("Failed to schedule wallet balance reload check"));

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).resolves.toBeUndefined();

    expect(instrumentation.recordDeposit).toHaveBeenCalledWith(500000, "uakt", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_WALLET_RELOAD_SCHEDULE_FAILED", walletId: 1, dseq: "123" }));
  });

  it("completes the job when logging the wallet reload scheduling failure itself throws", async () => {
    const { service, drainingDeploymentService, walletReloadJobService, instrumentation, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    walletReloadJobService.scheduleImmediate.mockRejectedValue(new Error("Failed to schedule wallet balance reload check"));
    logger.error.mockImplementation(() => {
      throw new Error("logger transport failure");
    });

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).resolves.toBeUndefined();

    expect(instrumentation.recordDeposit).toHaveBeenCalledWith(500000, "uakt", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
  });

  it("skips funding when auto top-up is disabled for the deployment", async () => {
    const { service, drainingDeploymentService, userWalletRepository, deploymentSettingRepository, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    userWalletRepository.findById.mockResolvedValue(createUserWallet({ id: 1, address: "akash1owner", userId: "user-1" }));
    deploymentSettingRepository.findOneBy.mockResolvedValue(mock<DeploymentSettingsOutput>({ autoTopUpEnabled: false }));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(deploymentSettingRepository.findOneBy).toHaveBeenCalledWith({ userId: "user-1", dseq: "123" });
    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_SKIPPED", reason: "AUTO_TOP_UP_DISABLED" }));
  });

  it("funds the deployment when auto top-up is explicitly enabled", async () => {
    const { service, drainingDeploymentService, deploymentSettingRepository, managedSignerService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    deploymentSettingRepository.findOneBy.mockResolvedValue(mock<DeploymentSettingsOutput>({ autoTopUpEnabled: true }));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(1, expect.anything());
  });

  it("throws and skips the wallet reload when the deposit tx fails on-chain", async () => {
    const { service, drainingDeploymentService, managedSignerService, walletReloadJobService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 5, hash: "TESTHASH", rawLog: "insufficient funds" });

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow("insufficient funds");

    expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_TX_FAILED", code: 5, txHash: "TESTHASH" }));
  });

  it("skips terminally when the deposit is rejected because the deployment escrow is closed", async () => {
    const { service, drainingDeploymentService, managedSignerService, chainErrorService, walletReloadJobService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockRejectedValue(new Error("Deployment closed"));
    chainErrorService.isDeploymentClosedError.mockReturnValue(true);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("deployment_closed", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
    expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
  });

  it("rethrows deposit errors unrelated to a closed deployment", async () => {
    const { service, drainingDeploymentService, managedSignerService, walletReloadJobService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockRejectedValue(new Error("Bad status on response: 503"));

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow("Bad status on response: 503");

    expect(instrumentation.recordSkipped).not.toHaveBeenCalled();
    expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
  });

  it("skips terminally when the deposit tx lands with a closed account in the raw log", async () => {
    const { service, drainingDeploymentService, managedSignerService, chainErrorService, walletReloadJobService, instrumentation, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 5, hash: "TESTHASH", rawLog: "account closed" });
    chainErrorService.isDeploymentClosedError.mockReturnValue(true);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("deployment_closed", expect.objectContaining({ txHash: "TESTHASH" }));
    expect(logger.error).not.toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_TX_FAILED" }));
    expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
  });

  it("falls back to a descriptive error when the failed deposit tx has no raw log", async () => {
    const { service, drainingDeploymentService, managedSignerService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 5, hash: "TESTHASH", rawLog: "" });

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow(
      "Deposit tx TESTHASH failed on-chain with code 5"
    );
  });

  it("clamps the deposit to the fresh deployment limit", async () => {
    const { service, drainingDeploymentService, rpcMessageService, cachedBalanceService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(200000, 0));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 200000 }));
  });

  it("skips funding when the deployment limit is exhausted", async () => {
    const { service, drainingDeploymentService, managedSignerService, instrumentation, cachedBalanceService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(0, 0));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(instrumentation.recordSkipped).toHaveBeenCalledWith(
      "insufficient_balance",
      expect.objectContaining({ dseq: "123", address: "akash1owner", available: 0, spendable: 0 })
    );
  });

  it("leaves the balance headroom untouched when sizing the deposit", async () => {
    const { service, drainingDeploymentService, rpcMessageService, cachedBalanceService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(10_000_000);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(10_000_000, 5_000_000));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 5_000_000 }));
  });

  it("funds the full balance when it is at or below the headroom", async () => {
    const { service, drainingDeploymentService, rpcMessageService, cachedBalanceService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(10_000_000);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(4_000_000, 5_000_000));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 4_000_000 }));
  });

  it("funds the full balance when it sits exactly at the headroom", async () => {
    const { service, drainingDeploymentService, rpcMessageService, cachedBalanceService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(10_000_000);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(5_000_000, 5_000_000));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 5_000_000 }));
  });

  it("skips funding when the wallet is not found", async () => {
    const { service, drainingDeploymentService, userWalletRepository, managedSignerService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    userWalletRepository.findById.mockResolvedValue(undefined);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("wallet_not_found", expect.objectContaining({ walletId: 1, dseq: "123" }));
  });

  it("skips funding when the fee allowance is exhausted", async () => {
    const { service, drainingDeploymentService, managedSignerService, instrumentation } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    managedSignerService.ensureFeeGrants.mockResolvedValue(0);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("no_fee_allowance", expect.objectContaining({ dseq: "123", address: "akash1owner" }));
  });

  it("starts the runtime countdown at lease start when the deployment has an unanchored runtime limit", async () => {
    const { service, drainingDeploymentService, deploymentSettingRepository } = setup();
    const deployment = createDrainingDeployment();
    const runtimeEndsAt = new Date("2026-08-21T12:00:00.000Z");
    drainingDeploymentService.findLeases.mockResolvedValue([deployment]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSetting({ runtimeLimitHours: 6, runtimeEndsAt: null }));
    deploymentSettingRepository.startRuntimeCountdown.mockResolvedValue(runtimeEndsAt);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(deploymentSettingRepository.startRuntimeCountdown).toHaveBeenCalledWith("setting-1");
    expect(drainingDeploymentService.calculateAmountToTargetRunway).toHaveBeenCalledWith({ ...deployment, runtimeEndsAt }, CURRENT_HEIGHT);
  });

  it("reuses an already anchored runtime deadline without rewriting it", async () => {
    const { service, drainingDeploymentService, deploymentSettingRepository } = setup();
    const deployment = createDrainingDeployment();
    const runtimeEndsAt = new Date("2026-08-21T12:00:00.000Z");
    drainingDeploymentService.findLeases.mockResolvedValue([deployment]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(500000);
    deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSetting({ runtimeLimitHours: 6, runtimeEndsAt }));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(deploymentSettingRepository.startRuntimeCountdown).not.toHaveBeenCalled();
    expect(drainingDeploymentService.calculateAmountToTargetRunway).toHaveBeenCalledWith({ ...deployment, runtimeEndsAt }, CURRENT_HEIGHT);
  });

  it("skips with runtime_limit_reached when the deployment is already funded to its deadline", async () => {
    const { service, drainingDeploymentService, deploymentSettingRepository, cachedBalanceService, managedSignerService, instrumentation } = setup();
    const runtimeEndsAt = new Date("2026-08-21T12:00:00.000Z");
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(0);
    deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSetting({ runtimeLimitHours: 6, runtimeEndsAt }));

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(instrumentation.recordSkipped).toHaveBeenCalledWith("runtime_limit_reached", { dseq: "123", address: "akash1owner", runtimeEndsAt });
    expect(cachedBalanceService.getFresh).not.toHaveBeenCalled();
    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
  });

  function createDeploymentSetting(overrides: Partial<DeploymentSettingsOutput> = {}): DeploymentSettingsOutput {
    return {
      id: "setting-1",
      userId: "user-1",
      dseq: "123",
      autoTopUpEnabled: true,
      closed: false,
      lastFundedAt: null,
      runtimeLimitHours: null,
      runtimeEndsAt: null,
      createdAt: new Date("2026-08-20T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-08-20T00:00:00.000Z").toISOString(),
      ...overrides
    };
  }

  function createDrainingDeployment(overrides: Partial<DrainingDeploymentOutput> = {}): DrainingDeploymentOutput {
    return {
      dseq: 123,
      owner: "akash1owner",
      denom: "uakt",
      blockRate: 50,
      predictedClosedHeight: CURRENT_HEIGHT + 100,
      ...overrides
    };
  }

  function setup() {
    const blockHttpService = mock<BlockHttpService>();
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const cachedBalanceService = mock<CachedBalanceService>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const billingConfig = mockConfigService<BillingConfigService>({ DEPLOYMENT_GRANT_DENOM: "uakt" });
    const deploymentConfig = mockConfigService<DeploymentConfigService>({ AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24 });
    const walletReloadJobService = mock<WalletReloadJobService>();
    const chainErrorService = mock<ChainErrorService>();
    const instrumentation = mock<InitialDeploymentFundingInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    blockHttpService.getCurrentHeight.mockResolvedValue(CURRENT_HEIGHT);
    cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(1000000, 0));
    userWalletRepository.findById.mockResolvedValue(createUserWallet({ id: 1, address: "akash1owner" }));
    managedSignerService.ensureFeeGrants.mockResolvedValue(100000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 0, hash: "TESTHASH", rawLog: "[]" });
    chainErrorService.isDeploymentClosedError.mockReturnValue(false);

    const service = new InitialDeploymentFundingService(
      blockHttpService,
      drainingDeploymentService,
      cachedBalanceService,
      rpcMessageService,
      managedSignerService,
      userWalletRepository,
      deploymentSettingRepository,
      billingConfig,
      deploymentConfig,
      walletReloadJobService,
      chainErrorService,
      instrumentation,
      createLogger
    );

    return {
      service,
      blockHttpService,
      drainingDeploymentService,
      cachedBalanceService,
      rpcMessageService,
      managedSignerService,
      userWalletRepository,
      deploymentSettingRepository,
      walletReloadJobService,
      chainErrorService,
      instrumentation,
      logger
    };
  }
});
