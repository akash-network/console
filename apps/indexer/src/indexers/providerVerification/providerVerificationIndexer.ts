import type * as verificationV1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import {
  ProviderMaintenance,
  VerificationAttestation,
  VerificationAttestationCapability,
  VerificationAuditEscrow,
  VerificationAuditEscrowCapability,
  VerificationAuditor,
  VerificationBlockEvent,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationGraceDiscrepancy,
  VerificationParams,
  VerificationProviderBond,
  VerificationProviderBondUnbonding,
  VerificationProviderObservation,
  VerificationProviderSnapshot,
  VerificationProviderTierDemotion,
  VerificationProviderTierStream,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import type { IGenesis } from "@src/chain/genesisTypes";
import { Indexer } from "../indexer";
import { parseProviderVerificationEventImpact, PROVIDER_VERIFICATION_EVENT_TYPES } from "./providerVerificationEvent";
import { toProviderVerificationReconcileTargets } from "./providerVerificationReconcileTarget";
import { ProviderVerificationRepository } from "./providerVerificationRepository";

const providerVerificationEventTypes = new Set(PROVIDER_VERIFICATION_EVENT_TYPES);

type VerificationEventRepository = Pick<
  ProviderVerificationRepository,
  "enqueue" | "enqueueAllProviders" | "enqueueMany" | "getUnprocessedBlockEvents" | "markBlockEventsProcessed"
>;

export class ProviderVerificationIndexer extends Indexer {
  constructor(private readonly repository: VerificationEventRepository = new ProviderVerificationRepository()) {
    super();
    this.name = "ProviderVerificationIndexer";
    this.runForEveryBlocks = true;
    this.processFailedTxs = false;
    this.msgHandlers = {
      "/akash.verification.v1.MsgRemoveAttestation": this.handleRemoveAttestation,
      "/akash.verification.v1.MsgUpdateParams": this.handleUpdateParams
    };
  }

  async dropTables(): Promise<void> {
    await VerificationProviderTierDemotion.drop({ cascade: true });
    await VerificationProviderTierStream.drop({ cascade: true });
    await VerificationGraceDiscrepancy.drop({ cascade: true });
    await VerificationAttestationCapability.drop({ cascade: true });
    await VerificationAuditEscrowCapability.drop({ cascade: true });
    await VerificationProviderBondUnbonding.drop({ cascade: true });
    await VerificationAttestation.drop({ cascade: true });
    await VerificationAuditEscrow.drop({ cascade: true });
    await VerificationProviderBond.drop({ cascade: true });
    await VerificationProviderObservation.drop({ cascade: true });
    await VerificationGrace.drop({ cascade: true });
    await ProviderMaintenance.drop({ cascade: true });
    await VerificationProviderSnapshot.drop({ cascade: true });
    await VerificationDiscrepancy.drop({ cascade: true });
    await VerificationAuditor.drop({ cascade: true });
    await VerificationParams.drop({ cascade: true });
    await VerificationReconcileTarget.drop({ cascade: true });
    await VerificationBlockEvent.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await VerificationAuditor.sync({ force: false });
    await VerificationAttestation.sync({ force: false });
    await VerificationAttestationCapability.sync({ force: false });
    await VerificationAuditEscrow.sync({ force: false });
    await VerificationAuditEscrowCapability.sync({ force: false });
    await VerificationDiscrepancy.sync({ force: false });
    await VerificationGrace.sync({ force: false });
    await VerificationGraceDiscrepancy.sync({ force: false });
    await VerificationProviderBond.sync({ force: false });
    await VerificationProviderObservation.sync({ force: false });
    await VerificationProviderTierStream.sync({ force: false });
    await VerificationProviderTierStream.findOrCreate({ where: { id: 1 } });
    await VerificationProviderTierDemotion.sync({ force: false });
    await VerificationProviderBondUnbonding.sync({ force: false });
    await VerificationProviderSnapshot.sync({ force: false });
    await ProviderMaintenance.sync({ force: false });
    await VerificationParams.sync({ force: false });
    await VerificationReconcileTarget.sync({ force: false });
    await VerificationBlockEvent.sync({ force: false });
  }

  initCache(): Promise<void> {
    return Promise.resolve();
  }

  seed(_genesis: IGenesis): Promise<void> {
    return Promise.resolve();
  }

  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    currentTransaction: Transaction,
    dbTransaction: DbTransaction,
    txEvents: TransactionEvent[]
  ): Promise<void> {
    for (const event of txEvents) {
      if (!providerVerificationEventTypes.has(event.type)) continue;
      const impact = parseProviderVerificationEventImpact({ type: event.type, attributes: event.attributes });
      await this.repository.enqueueMany(toProviderVerificationReconcileTargets(impact), currentTransaction.height, dbTransaction);
    }
  }

  async afterEveryBlock(currentBlock: Block, _previousBlock: Block | null, dbTransaction: DbTransaction): Promise<void> {
    const events = await this.repository.getUnprocessedBlockEvents(currentBlock.height, dbTransaction);
    for (const event of events) {
      const attributes = Object.entries(event.data).map(([key, value]) => ({ key, value }));
      const impact = parseProviderVerificationEventImpact({ type: event.type, attributes });
      await this.repository.enqueueMany(toProviderVerificationReconcileTargets(impact), currentBlock.height, dbTransaction);
    }
    if (events.length > 0) await this.repository.markBlockEventsProcessed(currentBlock.height, dbTransaction);
  }

  private async handleRemoveAttestation(message: verificationV1.MsgRemoveAttestation, height: number, transaction: DbTransaction): Promise<void> {
    await this.repository.enqueue({ targetType: "provider", targetKey: message.provider }, height, transaction);
  }

  private async handleUpdateParams(_message: verificationV1.Verification_MsgUpdateParams, height: number, transaction: DbTransaction): Promise<void> {
    await this.repository.enqueue({ targetType: "global", targetKey: "*" }, height, transaction);
    await this.repository.enqueueAllProviders(height, transaction);
  }
}
