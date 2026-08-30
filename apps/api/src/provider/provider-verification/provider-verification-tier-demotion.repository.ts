import {
  VerificationBlockEvent,
  VerificationParams,
  VerificationProviderTierDemotion,
  VerificationProviderTierStream,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction as DbTransaction } from "sequelize";
import { Op, Transaction } from "sequelize";
import { singleton } from "tsyringe";

export interface ProviderVerificationTierDemotionRows {
  stream: VerificationProviderTierStream | null;
  params: VerificationParams | null;
  demotions: VerificationProviderTierDemotion[];
  headCursor: string;
  globallyComplete: boolean;
}

@singleton()
export class ProviderVerificationTierDemotionRepository {
  async getFeed(after: string, limit: number): Promise<ProviderVerificationTierDemotionRows> {
    const connection = VerificationProviderTierDemotion.sequelize;
    if (!connection) throw new Error("Provider verification tier models are not registered with a database connection");

    return connection.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, transaction =>
      this.getFeedInTransaction(after, limit, transaction)
    );
  }

  private async getFeedInTransaction(after: string, limit: number, transaction: DbTransaction): Promise<ProviderVerificationTierDemotionRows> {
    const stream = await VerificationProviderTierStream.findByPk(1, { transaction });
    const params = await VerificationParams.findByPk(1, { attributes: ["params"], transaction });
    const head = await VerificationProviderTierDemotion.findOne({ attributes: ["id"], order: [["id", "DESC"]], transaction });
    const demotions = await VerificationProviderTierDemotion.findAll({
      where: { id: { [Op.gt]: after } },
      order: [["id", "ASC"]],
      limit,
      transaction
    });
    const pendingGlobalTargets = await VerificationReconcileTarget.count({
      where: { invalidated: true, targetType: { [Op.ne]: "provider" } },
      transaction
    });
    const unprocessedBlockEvents = await VerificationBlockEvent.count({ where: { isProcessed: false }, transaction });

    return {
      stream,
      params,
      demotions,
      headCursor: head?.id ?? "0",
      globallyComplete: pendingGlobalTargets === 0 && unprocessedBlockEvents === 0
    };
  }
}
