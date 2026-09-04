import { singleton } from "tsyringe";

import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { type Job, JOB_NAME, type JobHandler, type JobPayload } from "@src/core";
import { DeploymentSettingRepository, type FundingClaim } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";
import { ReconcileManagedTxInstrumentationService } from "./reconcile-managed-tx-instrumentation.service";

/** Resolves a funding transaction the signer left undecided, so its funding claims are not held for the whole dedup cooldown on a transaction that never landed. */
export class ReconcileManagedTx implements Job {
  static readonly [JOB_NAME] = "ReconcileManagedTx";
  readonly name = ReconcileManagedTx[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      txHash: string;
      owner: string;
      claims: FundingClaim[];
    }
  ) {}
}

@singleton()
export class ReconcileManagedTxHandler implements JobHandler<ReconcileManagedTx> {
  public readonly accepts = ReconcileManagedTx;

  /** Gives the command's per-hash singletonKey its meaning: without it the key is inert and two callers queue two jobs. */
  public readonly policy = "singleton";

  constructor(
    private readonly txPresenceService: TxPresenceService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly instrumentation: ReconcileManagedTxInstrumentationService
  ) {}

  /**
   * Only a transaction the chain shows as reverted releases its claims. A transaction the chain does not show is
   * left holding them: absence over a pooled endpoint can mean a lagging member rather than a transaction that never
   * landed, and releasing on that would deposit a second time — the outcome the claims are held to prevent. Waiting
   * instead costs the dedup cooldown, against a funding target measured in days.
   *
   * A query that fails to answer is rethrown so the job retries, since a node that recovers can still decide this.
   */
  async handle(payload: JobPayload<ReconcileManagedTx>): Promise<void> {
    const { txHash, owner, claims } = payload;
    const tx = await this.txPresenceService.findTx(txHash);

    if (!tx) {
      this.instrumentation.recordResolution("not_seen", { txHash, owner, deploymentIds: claims.map(claim => claim.id) });
      return;
    }

    if (tx.code === COSMOS_TX_CODE_OK) {
      this.instrumentation.recordResolution("landed", { txHash, owner, height: tx.height, deploymentIds: claims.map(claim => claim.id) });
      return;
    }

    await this.deploymentSettingRepository.releaseFundingClaim(claims);
    this.instrumentation.recordResolution("reverted", { txHash, owner, code: tx.code, rawLog: tx.rawLog, deploymentIds: claims.map(claim => claim.id) });
  }
}
