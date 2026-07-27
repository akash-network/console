import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { RpcMessageService } from "@src/billing/services";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { InitialDeploymentFundingService } from "./initial-deployment-funding.service";

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
    const { service, drainingDeploymentService, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment({ closedHeight: 900 })]);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_SKIPPED", reason: "DEPLOYMENT_CLOSED" }));
  });

  it("skips funding when the deployment already has more runway than the look-ahead window", async () => {
    const { service, drainingDeploymentService, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment({ predictedClosedHeight: LOOK_AHEAD_HEIGHT + 1 })]);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_SKIPPED", reason: "SUFFICIENT_RUNWAY" }));
  });

  it("deposits the calculated top-up amount and schedules a wallet reload", async () => {
    const { service, drainingDeploymentService, balancesService, rpcMessageService, managedSignerService, walletReloadJobService } = setup();
    const depositMessage = { typeUrl: "/akash.escrow.v1.MsgAccountDeposit", value: {} };
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 1000000 });
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
    expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ walletId: 1 });
  });

  it("throws and skips the wallet reload when the deposit tx fails on-chain", async () => {
    const { service, drainingDeploymentService, balancesService, managedSignerService, walletReloadJobService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 1000000 });
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 5, hash: "TESTHASH", rawLog: "insufficient funds" });

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow("insufficient funds");

    expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_TX_FAILED", code: 5, txHash: "TESTHASH" }));
  });

  it("falls back to a descriptive error when the failed deposit tx has no raw log", async () => {
    const { service, drainingDeploymentService, balancesService, managedSignerService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 1000000 });
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 5, hash: "TESTHASH", rawLog: "" });

    await expect(service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" })).rejects.toThrow(
      "Deposit tx TESTHASH failed on-chain with code 5"
    );
  });

  it("clamps the deposit to the fresh deployment limit", async () => {
    const { service, drainingDeploymentService, balancesService, rpcMessageService } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 200000 });

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 200000 }));
  });

  it("skips funding when the deployment limit is exhausted", async () => {
    const { service, drainingDeploymentService, balancesService, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 0 });

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_INSUFFICIENT_BALANCE" }));
  });

  it("skips funding when the wallet is not found", async () => {
    const { service, drainingDeploymentService, balancesService, userWalletRepository, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 1000000 });
    userWalletRepository.findById.mockResolvedValue(undefined);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_WALLET_NOT_FOUND" }));
  });

  it("skips funding when the fee allowance is exhausted", async () => {
    const { service, drainingDeploymentService, balancesService, managedSignerService, logger } = setup();
    drainingDeploymentService.findLeases.mockResolvedValue([createDrainingDeployment()]);
    drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(500000);
    balancesService.getFreshLimits.mockResolvedValue({ fee: 100000, deployment: 1000000 });
    managedSignerService.ensureFeeGrants.mockResolvedValue(0);

    await service.fundOnLeaseStarted({ walletId: 1, address: "akash1owner", dseq: "123" });

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_NO_FEE_ALLOWANCE" }));
  });

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
    const balancesService = mock<BalancesService>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const billingConfig = mockConfigService<BillingConfigService>({ DEPLOYMENT_GRANT_DENOM: "uakt" });
    const deploymentConfig = mockConfigService<DeploymentConfigService>({ AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24 });
    const walletReloadJobService = mock<WalletReloadJobService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    blockHttpService.getCurrentHeight.mockResolvedValue(CURRENT_HEIGHT);
    userWalletRepository.findById.mockResolvedValue(createUserWallet({ id: 1, address: "akash1owner" }));
    managedSignerService.ensureFeeGrants.mockResolvedValue(100000);
    managedSignerService.executeDerivedTx.mockResolvedValue({ code: 0, hash: "TESTHASH", rawLog: "[]" });

    const service = new InitialDeploymentFundingService(
      blockHttpService,
      drainingDeploymentService,
      balancesService,
      rpcMessageService,
      managedSignerService,
      userWalletRepository,
      billingConfig,
      deploymentConfig,
      walletReloadJobService,
      createLogger
    );

    return {
      service,
      blockHttpService,
      drainingDeploymentService,
      balancesService,
      rpcMessageService,
      managedSignerService,
      userWalletRepository,
      walletReloadJobService,
      logger
    };
  }
});
