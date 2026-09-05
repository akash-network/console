import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LandedTx, TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import type { DeploymentSettingRepository, FundingClaim } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ReconcileManagedTxHandler } from "./reconcile-managed-tx.handler";
import type { ReconcileManagedTxInstrumentationService } from "./reconcile-managed-tx-instrumentation.service";

const TX_HASH = "ABC123";
const OWNER = "akash1owner";

describe(ReconcileManagedTxHandler.name, () => {
  it("holds the claims of a transaction that landed, so its deposit is not made twice", async () => {
    const { handler, txPresenceService, deploymentSettingRepository, instrumentation } = setup();
    txPresenceService.findTx.mockResolvedValue(landedTx({ code: 0 }));

    await handler.handle(payload());

    expect(deploymentSettingRepository.releaseFundingClaim).not.toHaveBeenCalled();
    expect(instrumentation.recordResolution).toHaveBeenCalledWith("landed", expect.objectContaining({ txHash: TX_HASH }));
  });

  it("releases the claims of a transaction that reverted, so the deployment is fundable again", async () => {
    const { handler, txPresenceService, deploymentSettingRepository, instrumentation } = setup();
    txPresenceService.findTx.mockResolvedValue(landedTx({ code: 11 }));

    await handler.handle(payload());

    expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith(claims());
    expect(instrumentation.recordResolution).toHaveBeenCalledWith("reverted", expect.objectContaining({ txHash: TX_HASH, code: 11 }));
  });

  it("holds the claims of a transaction the chain does not show, since a lagging node cannot prove it never landed", async () => {
    const { handler, txPresenceService, deploymentSettingRepository, instrumentation } = setup();
    txPresenceService.findTx.mockResolvedValue(null);

    await handler.handle(payload());

    expect(deploymentSettingRepository.releaseFundingClaim).not.toHaveBeenCalled();
    expect(instrumentation.recordResolution).toHaveBeenCalledWith("not_seen", expect.objectContaining({ txHash: TX_HASH }));
  });

  it("throws when the chain could not be asked, so the job retries", async () => {
    const { handler, txPresenceService, deploymentSettingRepository } = setup();
    txPresenceService.findTx.mockRejectedValue(new Error("node unreachable"));

    await expect(handler.handle(payload())).rejects.toThrow("node unreachable");
    expect(deploymentSettingRepository.releaseFundingClaim).not.toHaveBeenCalled();
  });

  function claims(): FundingClaim[] {
    return [{ id: "setting-1", claimedAt: "2026-09-04 12:00:00.123456" }];
  }

  function payload() {
    return { txHash: TX_HASH, owner: OWNER, claims: claims(), version: 1 as const };
  }

  function landedTx(input: { code: number }): LandedTx {
    return { hash: TX_HASH, code: input.code, height: 100, rawLog: "" };
  }

  function setup() {
    const txPresenceService = mock<TxPresenceService>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const instrumentation = mock<ReconcileManagedTxInstrumentationService>();
    const handler = new ReconcileManagedTxHandler(txPresenceService, deploymentSettingRepository, instrumentation);

    return { handler, txPresenceService, deploymentSettingRepository, instrumentation };
  }
});
