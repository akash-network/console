import type * as v2beta2 from "@akashnetwork/akash-api/akash/market/v1beta2";
import type * as v1beta1 from "@akashnetwork/akash-api/deprecated/akash/market/v1beta1";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { decodeMsg } from "@src/utils/protobuf";

@singleton()
export class MessageRepository {
  async getDeploymentRelatedMessages(deploymentId: string) {
    const relatedMessages = await Message.findAll({
      where: {
        relatedDeploymentId: deploymentId,
        type: {
          [Op.notIn]: ["/akash.market.v1beta1.MsgWithdrawLease", "/akash.market.v1beta2.MsgWithdrawLease"]
        }
      },
      include: [
        {
          model: Transaction,
          required: true
        },
        {
          model: Block,
          required: true
        }
      ]
    });

    const createBidMsgs = relatedMessages
      .filter(msg => msg.type.endsWith("MsgCreateBid"))
      .map(msg => ({
        decoded: decodeMsg(msg.type, msg.data) as v1beta1.MsgCreateBid | v2beta2.MsgCreateBid,
        msg: msg
      }));

    const createLeaseMsgs = relatedMessages
      .filter(x => x.type.endsWith("MsgCreateLease"))
      .map(msg => decodeMsg(msg.type, msg.data) as v1beta1.MsgCreateLease | v2beta2.MsgCreateLease);

    const acceptedBids = createBidMsgs.filter(createBidMsg =>
      createLeaseMsgs.some(
        l =>
          l.bidId?.gseq === createBidMsg.decoded.order?.gseq &&
          l.bidId?.oseq === createBidMsg.decoded.order?.oseq &&
          l.bidId?.provider === createBidMsg.decoded.provider
      )
    );

    const filteredMessages = relatedMessages
      .filter(msg => !msg.type.endsWith("MsgCreateBid"))
      .concat(acceptedBids.map(x => x.msg))
      .sort((a, b) => b.height - a.height);

    return filteredMessages.map(msg => ({
      txHash: msg.transaction.hash,
      date: msg.block.datetime,
      type: msg.type
    }));
  }
}
