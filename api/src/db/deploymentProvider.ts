import * as v1 from "@src/proto/akash/v1beta1";
import * as v2 from "@src/proto/akash/v1beta2";
import { decodeMsg } from "@src/utils/protobuf";
import { Transaction } from "@shared/dbSchemas/base";
import { Deployment } from "@shared/dbSchemas/akash";
import { Op } from "sequelize";
import { Block, Message } from "@shared/dbSchemas";

export async function getDeploymentRelatedMessages(owner: string, dseq: string) {
  const deployment = await Deployment.findOne({
    attributes: ["id"],
    where: {
      owner: owner,
      dseq: dseq
    }
  });

  if (!deployment) {
    return null;
  }

  const relatedMessages = await Message.findAll({
    where: {
      relatedDeploymentId: deployment.id,
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
    .filter((msg) => msg.type.endsWith("MsgCreateBid"))
    .map((msg) => ({
      decoded: decodeMsg(msg.type, msg.data) as v1.MsgCreateBid | v2.MsgCreateBid,
      msg: msg
    }));

  const createLeaseMsgs = relatedMessages
    .filter((x) => x.type.endsWith("MsgCreateLease"))
    .map((msg) => decodeMsg(msg.type, msg.data) as v1.MsgCreateLease | v2.MsgCreateLease);

  const acceptedBids = createBidMsgs.filter((createBidMsg) =>
    createLeaseMsgs.some(
      (l) =>
        l.bidId.gseq === createBidMsg.decoded.order.gseq &&
        l.bidId.oseq === createBidMsg.decoded.order.oseq &&
        l.bidId.provider === createBidMsg.decoded.provider
    )
  );

  const filteredMessages = relatedMessages
    .filter((msg) => !msg.type.endsWith("MsgCreateBid"))
    .concat(acceptedBids.map((x) => x.msg))
    .sort((a, b) => b.height - a.height);

  return filteredMessages.map((msg) => ({
    txHash: msg.transaction.hash,
    date: msg.block.datetime,
    type: msg.type
  }));
}
