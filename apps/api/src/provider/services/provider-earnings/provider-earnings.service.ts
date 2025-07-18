import { Block } from "@akashnetwork/database/dbSchemas";
import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import assert from "http-assert";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { ProviderEarningsQuery, ProviderEarningsResponse } from "@src/provider/http-schemas/provider-earnings.schema";
import { getProviderEarningsAtHeight } from "@src/services/db/statsService";

@singleton()
export class ProviderEarningsService {
  async getProviderEarnings(owner: string, { from, to }: ProviderEarningsQuery): Promise<ProviderEarningsResponse> {
    const provider = await Provider.findOne({
      where: {
        owner
      }
    });
    assert(provider, 404, "Provider not found");

    const [fromBlock, toBlock] = await Promise.all([
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          isProcessed: true,
          totalUUsdSpent: { [Op.not]: null },
          datetime: { [Op.gte]: from }
        }
      }),
      Block.findOne({
        order: [["datetime", "ASC"]],
        where: {
          isProcessed: true,
          totalUUsdSpent: { [Op.not]: null },
          datetime: { [Op.gte]: to }
        }
      })
    ]);
    assert(fromBlock, 404, "From block not found");
    assert(toBlock, 404, "To block not found");

    const [earnings] = await Promise.all([getProviderEarningsAtHeight(provider.owner, fromBlock.height, toBlock.height)]);

    return {
      earnings: {
        totalUAktEarned: earnings.uakt,
        totalUUsdcEarned: earnings.uusdc,
        totalUUsdEarned: earnings.uusd
      }
    };
  }
}
