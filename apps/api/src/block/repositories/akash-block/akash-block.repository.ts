import { AkashBlock, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction, Validator } from "@akashnetwork/database/dbSchemas/base";
import { singleton } from "tsyringe";

@singleton()
export class AkashBlockRepository {
  async getBlocks(limit: number) {
    const _limit = Math.min(limit, 100);
    const blocks = await AkashBlock.findAll({
      order: [["height", "DESC"]],
      limit: _limit,
      include: [
        {
          model: Validator,
          as: "proposerValidator",
          required: true
        }
      ]
    });

    return blocks.map(block => ({
      height: block.height,
      proposer: {
        address: block.proposerValidator.accountAddress,
        operatorAddress: block.proposerValidator.operatorAddress,
        moniker: block.proposerValidator.moniker,
        avatarUrl: block.proposerValidator.keybaseAvatarUrl
      },
      transactionCount: block.txCount,
      totalTransactionCount: block.totalTxCount,
      datetime: block.datetime
    }));
  }

  async getBlockByHeight(height: number) {
    const block = await AkashBlock.findOne({
      where: {
        height: height
      },
      include: [
        {
          model: Transaction,
          include: [Message],
          order: ["index", "ASC"]
        },
        {
          model: Validator,
          as: "proposerValidator",
          required: true
        }
      ]
    });

    if (!block) return null;

    return {
      height: block.height,
      datetime: block.datetime,
      proposer: {
        operatorAddress: block.proposerValidator.operatorAddress,
        moniker: block.proposerValidator.moniker,
        avatarUrl: block.proposerValidator.keybaseAvatarUrl,
        address: block.proposerValidator.accountAddress
      },
      hash: block.hash,
      gasUsed: block.transactions.map(tx => tx.gasUsed).reduce((a, b) => a + b, 0),
      gasWanted: block.transactions.map(tx => tx.gasWanted).reduce((a, b) => a + b, 0),
      transactions: block.transactions.map(tx => ({
        hash: tx.hash,
        isSuccess: !tx.hasProcessingError,
        error: tx.hasProcessingError ? tx.log : null,
        fee: parseInt(tx.fee),
        datetime: block.datetime,
        messages: (tx.messages || []).map(message => ({
          id: message.id,
          type: message.type,
          amount: parseInt(message.amount || "0")
        }))
      }))
    };
  }
}
