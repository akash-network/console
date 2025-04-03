import type * as v2beta2 from "@akashnetwork/akash-api/akash/market/v1beta2";
import type * as v1beta1 from "@akashnetwork/akash-api/deprecated/akash/market/v1beta1";
import { Block, Message } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import type { WhereOptions } from "sequelize";
import { Op } from "sequelize";

import { decodeMsg } from "@src/utils/protobuf";

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
        l.bidId.gseq === createBidMsg.decoded.order.gseq &&
        l.bidId.oseq === createBidMsg.decoded.order.oseq &&
        l.bidId.provider === createBidMsg.decoded.provider
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

export async function getProviderDeploymentsCount(provider: string, status?: "active" | "closed") {
  const leaseFilter: WhereOptions<Lease> = { providerAddress: provider };
  if (status) {
    leaseFilter.closedHeight = status === "active" ? null : { [Op.ne]: null };
  }

  const result = await Deployment.count({
    include: [{ model: Lease, attributes: [], required: true, where: leaseFilter }]
  });

  return result;
}

export async function getProviderDeployments(provider: string, skip: number, limit: number, status?: "active" | "closed") {
  const leaseFilter: WhereOptions<Lease> = { providerAddress: provider };

  if (status) {
    leaseFilter.closedHeight = status === "active" ? null : { [Op.ne]: null };
  }

  const deploymentDseqs = await Deployment.findAll({
    attributes: ["dseq", "createdHeight"],
    include: [{ model: Lease, attributes: [], required: true, where: leaseFilter }],
    order: [["createdHeight", "DESC"]],
    offset: skip,
    limit: limit
  });

  const deployments = await Deployment.findAll({
    where: {
      dseq: { [Op.in]: deploymentDseqs.map(d => d.dseq) }
    },
    include: [
      {
        model: Lease,
        required: true,
        where: { providerAddress: provider },
        include: [
          { model: Block, required: true, as: "createdBlock" },
          { model: Block, required: false, as: "closedBlock" }
        ]
      },
      { model: Block, required: true, as: "createdBlock" },
      { model: Block, required: false, as: "closedBlock" }
    ],
    order: [["createdHeight", "DESC"]]
  });

  return deployments.map(d => ({
    owner: d.owner,
    dseq: d.dseq,
    denom: d.denom,
    createdHeight: d.createdHeight,
    createdDate: d.createdBlock.datetime,
    closedHeight: d.closedHeight,
    closedDate: d.closedHeight ? d.closedBlock.datetime : null,
    status: d.closedHeight ? "closed" : "active",
    balance: d.balance,
    transferred: d.withdrawnAmount,
    settledAt: d.lastWithdrawHeight,
    resources: {
      cpu: d.leases.reduce((acc, l) => acc + l.cpuUnits, 0),
      memory: d.leases.reduce((acc, l) => acc + l.memoryQuantity, 0),
      gpu: d.leases.reduce((acc, l) => acc + l.gpuUnits, 0),
      ephemeralStorage: d.leases.reduce((acc, l) => acc + l.ephemeralStorageQuantity, 0),
      persistentStorage: d.leases.reduce((acc, l) => acc + l.persistentStorageQuantity, 0)
    },
    leases: d.leases.map(l => ({
      provider: l.providerAddress,
      gseq: l.gseq,
      oseq: l.oseq,
      price: l.price,
      createdHeight: l.createdHeight,
      createdDate: l.createdBlock.datetime,
      closedHeight: l.closedHeight,
      closedDate: l.closedHeight ? l.closedBlock.datetime : null,
      status: l.closedHeight ? "closed" : "active",
      resources: {
        cpu: l.cpuUnits,
        memory: l.memoryQuantity,
        gpu: l.gpuUnits,
        ephemeralStorage: l.ephemeralStorageQuantity,
        persistentStorage: l.persistentStorageQuantity
      }
    }))
  }));
}
