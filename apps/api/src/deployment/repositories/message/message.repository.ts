import type * as v1beta2 from "@akashnetwork/akash-api/akash/market/v1beta2";
import type * as v1beta3 from "@akashnetwork/akash-api/akash/market/v1beta3";
import type * as v1beta4 from "@akashnetwork/akash-api/akash/market/v1beta4";
import type * as v1beta1 from "@akashnetwork/akash-api/deprecated/akash/market/v1beta1";
import type * as v1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
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
        decoded: decodeMsg(msg.type, msg.data) as
          | v1beta1.MsgCreateBid
          | v1beta2.MsgCreateBid
          | v1beta3.MsgCreateBid
          | v1beta4.MsgCreateBid
          | v1beta5.MsgCreateBid,
        msg: msg
      }));

    const createLeaseMsgs = relatedMessages
      .filter(x => x.type.endsWith("MsgCreateLease"))
      .map(
        msg =>
          decodeMsg(msg.type, msg.data) as
            | v1beta1.MsgCreateLease
            | v1beta2.MsgCreateLease
            | v1beta3.MsgCreateLease
            | v1beta4.MsgCreateLease
            | v1beta5.MsgCreateLease
      );

    const acceptedBids = createBidMsgs.filter(createBidMsg =>
      createLeaseMsgs.some(l => {
        const bidGseq = "gseq" in createBidMsg.decoded ? createBidMsg.decoded.gseq : (createBidMsg.decoded as v1beta5.MsgCreateBid).id?.gseq;
        const bidOseq = "oseq" in createBidMsg.decoded ? createBidMsg.decoded.oseq : (createBidMsg.decoded as v1beta5.MsgCreateBid).id?.oseq;
        const bidProvider = "provider" in createBidMsg.decoded ? createBidMsg.decoded.provider : (createBidMsg.decoded as v1beta5.MsgCreateBid).id?.provider;
        return l.bidId?.gseq === bidGseq && l.bidId?.oseq === bidOseq && l.bidId?.provider === bidProvider;
      })
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
