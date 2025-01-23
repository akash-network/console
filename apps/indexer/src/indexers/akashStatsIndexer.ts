import * as v1beta1 from "@akashnetwork/akash-api/v1beta1";
import * as v1beta2 from "@akashnetwork/akash-api/v1beta2";
import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";
import {
  Bid,
  Deployment,
  DeploymentGroup,
  DeploymentGroupResource,
  Lease,
  Provider,
  ProviderAttribute,
  ProviderAttributeSignature,
  ProviderSnapshot,
  ProviderSnapshotNode,
  ProviderSnapshotNodeCPU,
  ProviderSnapshotNodeGPU,
  ProviderSnapshotStorage
} from "@akashnetwork/database/dbSchemas/akash";
import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Op, Transaction as DbTransaction } from "sequelize";
import * as uuid from "uuid";

import { accountSettle } from "@src/shared/utils/akashPaymentSettle";
import { getAmountFromCoin } from "@src/shared/utils/coin";
import { uint8arrayToString } from "@src/shared/utils/protobuf";
import * as benchmark from "../shared/utils/benchmark";
import { Indexer } from "./indexer";
import { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { DecodedTxRaw } from "@cosmjs/proto-signing";

class IActiveLeases {
  predictedClosedHeights: number[];
  count: number;
  cpuSum: number;
  gpuSum: number;
  memorySum: number;
  ephemeralStorageSum: number;
  persistentStorageSum: number;
  priceSumUAKT: number;
  priceSumUUSDC: number;
}

const denomMapping = {
  uakt: "uakt",
  "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84": "uusdc", // USDC on Sandbox
  "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1": "uusdc" // USDC on Mainnet
};

export class AkashStatsIndexer extends Indexer {
  private totalLeaseCount = 0;
  private activeProviderCount = 0;
  private activeLeases: IActiveLeases;

  constructor() {
    super();
    this.name = "AkashStatsIndexer";
    this.runForEveryBlocks = true;
    this.msgHandlers = {
      // Akash v1beta1 types
      "/akash.deployment.v1beta1.MsgCreateDeployment": this.handleCreateDeployment,
      "/akash.deployment.v1beta1.MsgCloseDeployment": this.handleCloseDeployment,
      "/akash.market.v1beta1.MsgCreateLease": this.handleCreateLease,
      "/akash.market.v1beta1.MsgCloseLease": this.handleCloseLease,
      "/akash.market.v1beta1.MsgCreateBid": this.handleCreateBid,
      "/akash.market.v1beta1.MsgCloseBid": this.handleCloseBid,
      "/akash.deployment.v1beta1.MsgDepositDeployment": this.handleDepositDeployment,
      "/akash.market.v1beta1.MsgWithdrawLease": this.handleWithdrawLease,
      "/akash.provider.v1beta1.MsgCreateProvider": this.handleCreateProvider,
      "/akash.provider.v1beta1.MsgUpdateProvider": this.handleUpdateProvider,
      "/akash.provider.v1beta1.MsgDeleteProvider": this.handleDeleteProvider,
      "/akash.audit.v1beta1.MsgSignProviderAttributes": this.handleSignProviderAttributes,
      "/akash.audit.v1beta1.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
      // Akash v1beta2 types
      "/akash.deployment.v1beta2.MsgCreateDeployment": this.handleCreateDeploymentV2,
      "/akash.deployment.v1beta2.MsgCloseDeployment": this.handleCloseDeployment,
      "/akash.market.v1beta2.MsgCreateLease": this.handleCreateLease,
      "/akash.market.v1beta2.MsgCloseLease": this.handleCloseLease,
      "/akash.market.v1beta2.MsgCreateBid": this.handleCreateBid,
      "/akash.market.v1beta2.MsgCloseBid": this.handleCloseBid,
      "/akash.deployment.v1beta2.MsgDepositDeployment": this.handleDepositDeployment,
      "/akash.market.v1beta2.MsgWithdrawLease": this.handleWithdrawLease,
      "/akash.provider.v1beta2.MsgCreateProvider": this.handleCreateProvider,
      "/akash.provider.v1beta2.MsgUpdateProvider": this.handleUpdateProvider,
      "/akash.provider.v1beta2.MsgDeleteProvider": this.handleDeleteProvider,
      "/akash.audit.v1beta2.MsgSignProviderAttributes": this.handleSignProviderAttributes,
      "/akash.audit.v1beta2.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
      // Akash v1beta3 types
      "/akash.deployment.v1beta3.MsgCreateDeployment": this.handleCreateDeploymentV3,
      "/akash.deployment.v1beta3.MsgCloseDeployment": this.handleCloseDeployment,
      "/akash.market.v1beta3.MsgCreateLease": this.handleCreateLease,
      "/akash.market.v1beta3.MsgCloseLease": this.handleCloseLease,
      "/akash.market.v1beta3.MsgCreateBid": this.handleCreateBid,
      "/akash.market.v1beta3.MsgCloseBid": this.handleCloseBid,
      "/akash.deployment.v1beta3.MsgDepositDeployment": this.handleDepositDeployment,
      "/akash.market.v1beta3.MsgWithdrawLease": this.handleWithdrawLease,
      "/akash.provider.v1beta3.MsgCreateProvider": this.handleCreateProvider,
      "/akash.provider.v1beta3.MsgUpdateProvider": this.handleUpdateProvider,
      "/akash.provider.v1beta3.MsgDeleteProvider": this.handleDeleteProvider,
      "/akash.audit.v1beta3.MsgSignProviderAttributes": this.handleSignProviderAttributes,
      "/akash.audit.v1beta3.MsgDeleteProviderAttributes": this.handleDeleteSignProviderAttributes,
      // Akash v1beta4 types
      "/akash.market.v1beta4.MsgCreateLease": this.handleCreateLease,
      "/akash.market.v1beta4.MsgCloseLease": this.handleCloseLease,
      "/akash.market.v1beta4.MsgCreateBid": this.handleCreateBid,
      "/akash.market.v1beta4.MsgCloseBid": this.handleCloseBid,
      "/akash.market.v1beta4.MsgWithdrawLease": this.handleWithdrawLease
    };
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await Bid.drop({ cascade: true });
    await Lease.drop({ cascade: true });
    await ProviderSnapshotNodeCPU.drop({ cascade: true });
    await ProviderSnapshotNodeGPU.drop({ cascade: true });
    await ProviderSnapshotStorage.drop({ cascade: true });
    await ProviderSnapshotNode.drop({ cascade: true });
    await ProviderSnapshot.drop({ cascade: true });
    await ProviderAttributeSignature.drop({ cascade: true });
    await ProviderAttribute.drop({ cascade: true });
    await Provider.drop({ cascade: true });
    await DeploymentGroupResource.drop({ cascade: true });
    await DeploymentGroup.drop({ cascade: true });
    await Deployment.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await Deployment.sync({ force: false });
    await DeploymentGroup.sync({ force: false });
    await DeploymentGroupResource.sync({ force: false });
    await Provider.sync({ force: false });
    await ProviderAttribute.sync({ force: false });
    await ProviderAttributeSignature.sync({ force: false });
    await ProviderSnapshot.sync({ force: false });
    await ProviderSnapshotStorage.sync({ force: false });
    await ProviderSnapshotNode.sync({ force: false });
    await ProviderSnapshotNodeCPU.sync({ force: false });
    await ProviderSnapshotNodeGPU.sync({ force: false });
    await Lease.sync({ force: false });
    await Bid.sync({ force: false });
  }

  async initCache(firstBlockHeight: number) {
    this.activeLeases = await this.getActiveLeases(null, firstBlockHeight);

    this.totalLeaseCount = await Lease.count();
    this.activeProviderCount = await Provider.count();
  }

  @benchmark.measureMethodAsync
  async afterEveryBlock(currentBlock: Block, previousBlock: Block, dbTransaction: DbTransaction) {
    const shouldRefreshPredictedHeights = currentBlock.transactions.some(tx => tx.messages.some(msg => this.checkShouldRefreshPredictedCloseHeight(msg)));

    if (shouldRefreshPredictedHeights || this.activeLeases.predictedClosedHeights.includes(currentBlock.height)) {
      this.activeLeases = await this.getActiveLeases(dbTransaction, currentBlock.height);
    }

    currentBlock.activeProviderCount = this.activeProviderCount;
    currentBlock.activeLeaseCount = this.activeLeases.count;
    currentBlock.totalLeaseCount = this.totalLeaseCount;
    currentBlock.activeCPU = this.activeLeases.cpuSum;
    currentBlock.activeGPU = this.activeLeases.gpuSum;
    currentBlock.activeMemory = this.activeLeases.memorySum;
    currentBlock.activeEphemeralStorage = this.activeLeases.ephemeralStorageSum;
    currentBlock.activePersistentStorage = this.activeLeases.persistentStorageSum;
    currentBlock.totalUAktSpent = (previousBlock?.totalUAktSpent || 0) + this.activeLeases.priceSumUAKT;
    currentBlock.totalUUsdcSpent = (previousBlock?.totalUUsdcSpent || 0) + this.activeLeases.priceSumUUSDC;
  }

  @benchmark.measureMethodAsync
  private async getActiveLeases(blockGroupTransaction: DbTransaction, height: number) {
    const activeLeases = await Lease.findAll({
      raw: true,
      attributes: [
        "cpuUnits",
        "gpuUnits",
        "memoryQuantity",
        "ephemeralStorageQuantity",
        "persistentStorageQuantity",
        "price",
        "denom",
        "predictedClosedHeight"
      ],
      where: {
        closedHeight: { [Op.is]: null },
        predictedClosedHeight: { [Op.gt]: height }
      },
      transaction: blockGroupTransaction
    });

    return {
      predictedClosedHeights: activeLeases.map(x => parseInt(x.predictedClosedHeight)),
      count: activeLeases.length,
      cpuSum: activeLeases.map(x => x.cpuUnits).reduce((a, b) => a + b, 0),
      gpuSum: activeLeases.map(x => x.gpuUnits).reduce((a, b) => a + b, 0),
      memorySum: activeLeases.map(x => x.memoryQuantity).reduce((a, b) => a + b, 0),
      ephemeralStorageSum: activeLeases.map(x => x.ephemeralStorageQuantity).reduce((a, b) => a + b, 0),
      persistentStorageSum: activeLeases.map(x => x.persistentStorageQuantity).reduce((a, b) => a + b, 0),
      priceSumUAKT: activeLeases
        .filter(x => x.denom === "uakt")
        .map(x => x.price)
        .reduce((a, b) => a + b, 0),
      priceSumUUSDC: activeLeases
        .filter(x => x.denom === "uusdc")
        .map(x => x.price)
        .reduce((a, b) => a + b, 0)
    };
  }

  private checkShouldRefreshPredictedCloseHeight(msg: Message): boolean {
    return [
      // v1beta1
      "/akash.deployment.v1beta1.MsgCreateDeployment",
      "/akash.deployment.v1beta1.MsgCloseDeployment",
      "/akash.market.v1beta1.MsgCreateLease",
      "/akash.market.v1beta1.MsgCloseLease",
      "/akash.market.v1beta1.MsgCloseBid",
      "/akash.deployment.v1beta1.MsgDepositDeployment",
      "/akash.market.v1beta1.MsgWithdrawLease",
      // v1beta2
      "/akash.deployment.v1beta2.MsgCreateDeployment",
      "/akash.deployment.v1beta2.MsgCloseDeployment",
      "/akash.market.v1beta2.MsgCreateLease",
      "/akash.market.v1beta2.MsgCloseLease",
      "/akash.market.v1beta2.MsgCloseBid",
      "/akash.deployment.v1beta2.MsgDepositDeployment",
      "/akash.market.v1beta2.MsgWithdrawLease",
      // v1beta3
      "/akash.deployment.v1beta3.MsgCreateDeployment",
      "/akash.deployment.v1beta3.MsgCloseDeployment",
      "/akash.market.v1beta3.MsgCreateLease",
      "/akash.market.v1beta3.MsgCloseLease",
      "/akash.market.v1beta3.MsgCloseBid",
      "/akash.deployment.v1beta3.MsgDepositDeployment",
      "/akash.market.v1beta3.MsgWithdrawLease",
      // v1beta4
      "/akash.market.v1beta4.MsgCreateLease",
      "/akash.market.v1beta4.MsgCloseLease",
      "/akash.market.v1beta4.MsgCloseBid",
      "/akash.market.v1beta4.MsgWithdrawLease"
    ].includes(msg.type);
  }

  private async handleCreateDeployment(decodedMessage: v1beta1.MsgCreateDeployment, height: number, blockGroupTransaction: DbTransaction, msg: Message) {
    const created = await Deployment.create(
      {
        id: uuid.v4(),
        owner: decodedMessage.id.owner,
        dseq: decodedMessage.id.dseq.toString(),
        deposit: parseInt(decodedMessage.deposit.amount),
        balance: parseInt(decodedMessage.deposit.amount),
        withdrawnAmount: 0,
        denom: "uakt",
        createdHeight: height,
        closedHeight: null
      },
      { transaction: blockGroupTransaction }
    );

    msg.relatedDeploymentId = created.id;

    for (const group of decodedMessage.groups) {
      const createdGroup = await DeploymentGroup.create(
        {
          id: uuid.v4(),
          deploymentId: created.id,
          owner: created.owner,
          dseq: created.dseq,
          gseq: decodedMessage.groups.indexOf(group) + 1
        },
        { transaction: blockGroupTransaction }
      );

      for (const groupResource of group.resources) {
        await DeploymentGroupResource.create(
          {
            deploymentGroupId: createdGroup.id,
            cpuUnits: parseInt(uint8arrayToString(groupResource.resources.cpu.units.val)),
            gpuUnits: 0,
            memoryQuantity: parseInt(uint8arrayToString(groupResource.resources.memory.quantity.val)),
            ephemeralStorageQuantity: parseInt(uint8arrayToString(groupResource.resources.storage.quantity.val)),
            persistentStorageQuantity: 0,
            count: groupResource.count,
            price: parseFloat(groupResource.price.amount) // TODO: handle denom
          },
          { transaction: blockGroupTransaction }
        );
      }
    }
  }

  private async handleCreateDeploymentV2(decodedMessage: v1beta2.MsgCreateDeployment, height: number, blockGroupTransaction: DbTransaction, msg: Message) {
    const created = await Deployment.create(
      {
        id: uuid.v4(),
        owner: decodedMessage.id.owner,
        dseq: decodedMessage.id.dseq.toString(),
        deposit: parseInt(decodedMessage.deposit.amount),
        balance: parseInt(decodedMessage.deposit.amount),
        withdrawnAmount: 0,
        denom: "uakt",
        createdHeight: height,
        closedHeight: null
      },
      { transaction: blockGroupTransaction }
    );

    msg.relatedDeploymentId = created.id;

    for (const group of decodedMessage.groups) {
      const createdGroup = await DeploymentGroup.create(
        {
          id: uuid.v4(),
          deploymentId: created.id,
          owner: created.owner,
          dseq: created.dseq,
          gseq: decodedMessage.groups.indexOf(group) + 1
        },
        { transaction: blockGroupTransaction }
      );

      for (const groupResource of group.resources) {
        await DeploymentGroupResource.create(
          {
            deploymentGroupId: createdGroup.id,
            cpuUnits: parseInt(uint8arrayToString(groupResource.resources.cpu.units.val)),
            gpuUnits: 0,
            memoryQuantity: parseInt(uint8arrayToString(groupResource.resources.memory.quantity.val)),
            ephemeralStorageQuantity: groupResource.resources.storage
              .filter(x => !isPersistentStorage(x))
              .map(x => parseInt(uint8arrayToString(x.quantity.val)))
              .reduce((a, b) => a + b, 0),
            persistentStorageQuantity: groupResource.resources.storage
              .filter(x => isPersistentStorage(x))
              .map(x => parseInt(uint8arrayToString(x.quantity.val)))
              .reduce((a, b) => a + b, 0),
            count: groupResource.count,
            price: parseFloat(groupResource.price.amount) // TODO: handle denom
          },
          { transaction: blockGroupTransaction }
        );
      }
    }
  }

  private async handleCreateDeploymentV3(decodedMessage: v1beta3.MsgCreateDeployment, height: number, blockGroupTransaction: DbTransaction, msg: Message) {
    if (!(decodedMessage.deposit.denom in denomMapping)) {
      throw "Unknown denom: " + decodedMessage.deposit.denom;
    }

    const created = await Deployment.create(
      {
        id: uuid.v4(),
        owner: decodedMessage.id.owner,
        dseq: decodedMessage.id.dseq.toString(),
        deposit: parseInt(decodedMessage.deposit.amount),
        balance: parseInt(decodedMessage.deposit.amount),
        withdrawnAmount: 0,
        denom: denomMapping[decodedMessage.deposit.denom],
        createdHeight: height,
        closedHeight: null
      },
      { transaction: blockGroupTransaction }
    );

    msg.relatedDeploymentId = created.id;

    for (const group of decodedMessage.groups) {
      const createdGroup = await DeploymentGroup.create(
        {
          id: uuid.v4(),
          deploymentId: created.id,
          owner: created.owner,
          dseq: created.dseq,
          gseq: decodedMessage.groups.indexOf(group) + 1
        },
        { transaction: blockGroupTransaction }
      );

      for (const groupResource of group.resources) {
        const { vendor: gpuVendor, model: gpuModel } = getGPUAttributes(groupResource.resource.gpu);

        await DeploymentGroupResource.create(
          {
            deploymentGroupId: createdGroup.id,
            cpuUnits: parseInt(uint8arrayToString(groupResource.resource.cpu.units.val)),
            gpuUnits: parseInt(uint8arrayToString(groupResource.resource.gpu.units.val)),
            gpuVendor: gpuVendor,
            gpuModel: gpuModel,
            memoryQuantity: parseInt(uint8arrayToString(groupResource.resource.memory.quantity.val)),
            ephemeralStorageQuantity: groupResource.resource.storage
              .filter(x => !isPersistentStorage(x))
              .map(x => parseInt(uint8arrayToString(x.quantity.val)))
              .reduce((a, b) => a + b, 0),
            persistentStorageQuantity: groupResource.resource.storage
              .filter(x => isPersistentStorage(x))
              .map(x => parseInt(uint8arrayToString(x.quantity.val)))
              .reduce((a, b) => a + b, 0),
            count: groupResource.count,
            price: parseFloat(groupResource.price.amount) // TODO: handle denom
          },
          { transaction: blockGroupTransaction }
        );
      }
    }
  }

  private async handleCloseDeployment(
    decodedMessage: v1beta1.MsgCloseDeployment | v1beta2.MsgCloseDeployment | v1beta3.MsgCloseDeployment,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const deployment = await Deployment.findOne({
      where: {
        owner: decodedMessage.id.owner,
        dseq: decodedMessage.id.dseq.toString()
      },
      include: [{ model: Lease }],
      transaction: blockGroupTransaction
    });

    if (!deployment) {
      throw new Error(`Deployment for ${decodedMessage.id.owner}/${decodedMessage.id.dseq.toString()} not found.`);
    }

    msg.relatedDeploymentId = deployment.id;

    await accountSettle(deployment, height, blockGroupTransaction);

    for (const lease of deployment.leases.filter(x => !x.closedHeight)) {
      lease.closedHeight = height;
      await lease.save({ transaction: blockGroupTransaction });
    }

    deployment.closedHeight = height;
    await deployment.save({ transaction: blockGroupTransaction });
  }

  private async handleCreateLease(
    decodedMessage: v1beta1.MsgCreateLease | v1beta2.MsgCreateLease | v1beta3.MsgCreateLease,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const bid = await Bid.findOne({
      where: {
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString(),
        gseq: decodedMessage.bidId.gseq,
        oseq: decodedMessage.bidId.oseq,
        provider: decodedMessage.bidId.provider
      },
      transaction: blockGroupTransaction
    });

    const deploymentGroup = await DeploymentGroup.findOne({
      attributes: ["id"],
      where: {
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString(),
        gseq: decodedMessage.bidId.gseq
      },
      include: [
        {
          model: DeploymentGroupResource,
          attributes: ["count", "cpuUnits", "gpuUnits", "memoryQuantity", "ephemeralStorageQuantity", "persistentStorageQuantity"],
          required: false
        }
      ],
      transaction: blockGroupTransaction
    });

    if (!deploymentGroup) {
      throw new Error(`Deployment group for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()}/${decodedMessage.bidId.gseq} not found.`);
    }

    const deployment = await Deployment.findOne({
      where: {
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString()
      },
      include: [{ model: Lease }],
      transaction: blockGroupTransaction
    });

    if (!deployment) {
      throw new Error(`Deployment for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()} not found.`);
    }

    const { blockRate } = await accountSettle(deployment, height, blockGroupTransaction);

    const predictedClosedHeight = Math.ceil(height + deployment.balance / (blockRate + bid.price));

    await Lease.create(
      {
        id: uuid.v4(),
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString(),
        oseq: decodedMessage.bidId.oseq,
        gseq: decodedMessage.bidId.gseq,
        providerAddress: decodedMessage.bidId.provider,
        createdHeight: height,
        predictedClosedHeight: predictedClosedHeight.toString(),
        price: bid.price,
        denom: deployment.denom,

        // Stats
        cpuUnits: deploymentGroup.deploymentGroupResources.map(x => x.cpuUnits * x.count).reduce((a, b) => a + b, 0),
        gpuUnits: deploymentGroup.deploymentGroupResources.map(x => x.gpuUnits * x.count).reduce((a, b) => a + b, 0),
        memoryQuantity: deploymentGroup.deploymentGroupResources.map(x => x.memoryQuantity * x.count).reduce((a, b) => a + b, 0),
        ephemeralStorageQuantity: deploymentGroup.deploymentGroupResources.map(x => x.ephemeralStorageQuantity * x.count).reduce((a, b) => a + b, 0),
        persistentStorageQuantity: deploymentGroup.deploymentGroupResources.map(x => x.persistentStorageQuantity * x.count).reduce((a, b) => a + b, 0)
      },
      { transaction: blockGroupTransaction }
    );

    await Lease.update(
      { predictedClosedHeight: predictedClosedHeight.toString() },
      { where: { deploymentId: deployment.id }, transaction: blockGroupTransaction }
    );

    msg.relatedDeploymentId = deployment.id;

    this.totalLeaseCount++;
  }

  private async handleCloseLease(
    decodedMessage: v1beta1.MsgCloseLease | v1beta1.MsgCloseLease,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const deployment = await Deployment.findOne({
      where: {
        owner: decodedMessage.leaseId.owner,
        dseq: decodedMessage.leaseId.dseq.toString()
      },
      include: [{ model: Lease }],
      transaction: blockGroupTransaction
    });

    if (!deployment) {
      throw new Error(`Deployment for ${decodedMessage.leaseId.owner}/${decodedMessage.leaseId.dseq.toString()} not found.`);
    }

    const lease = deployment.leases.find(
      x => x.oseq === decodedMessage.leaseId.oseq && x.gseq === decodedMessage.leaseId.gseq && x.providerAddress === decodedMessage.leaseId.provider
    );

    if (!lease)
      throw new Error(
        `Lease for ${decodedMessage.leaseId.owner}/${decodedMessage.leaseId.dseq}/${decodedMessage.leaseId.gseq}/${decodedMessage.leaseId.provider} not found.`
      );

    msg.relatedDeploymentId = deployment.id;

    const { blockRate } = await accountSettle(deployment, height, blockGroupTransaction);

    lease.closedHeight = height;
    await lease.save({ transaction: blockGroupTransaction });

    if (!deployment.leases.some(x => !x.closedHeight)) {
      deployment.closedHeight = height;
      await deployment.save({ transaction: blockGroupTransaction });
    } else {
      const predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / (blockRate - lease.price));
      await Lease.update(
        { predictedClosedHeight: predictedClosedHeight.toString() },
        { where: { deploymentId: deployment.id }, transaction: blockGroupTransaction }
      );
    }
  }

  private async handleCreateBid(
    decodedMessage: v1beta1.MsgCreateBid | v1beta2.MsgCreateBid | v1beta3.MsgCreateBid | v1beta4.MsgCreateBid,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    await Bid.create(
      {
        owner: decodedMessage.order.owner,
        dseq: decodedMessage.order.dseq.toString(),
        gseq: decodedMessage.order.gseq,
        oseq: decodedMessage.order.oseq,
        provider: decodedMessage.provider,
        price: parseFloat(decodedMessage.price.amount),
        createdHeight: height
      },
      { transaction: blockGroupTransaction }
    );

    const deployment = await Deployment.findOne({
      attributes: ["id"],
      where: {
        owner: decodedMessage.order.owner,
        dseq: decodedMessage.order.dseq.toString()
      },
      transaction: blockGroupTransaction
    });

    msg.relatedDeploymentId = deployment.id;
  }

  private async handleCloseBid(
    decodedMessage: v1beta1.MsgCloseBid | v1beta2.MsgCloseBid | v1beta3.MsgCloseBid,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const deployment = await Deployment.findOne({
      where: {
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString()
      },
      include: [{ model: Lease }],
      transaction: blockGroupTransaction
    });

    if (!deployment) {
      throw new Error(`Deployment for ${decodedMessage.bidId.owner}/${decodedMessage.bidId.dseq.toString()} not found.`);
    }

    msg.relatedDeploymentId = deployment.id;

    const lease = deployment.leases.find(
      x => x.oseq === decodedMessage.bidId.oseq && x.gseq === decodedMessage.bidId.gseq && x.providerAddress === decodedMessage.bidId.provider
    );

    if (lease) {
      const { blockRate } = await accountSettle(deployment, height, blockGroupTransaction);

      lease.closedHeight = height;
      await lease.save({ transaction: blockGroupTransaction });

      if (!deployment.leases.some(x => !x.closedHeight)) {
        deployment.closedHeight = height;
        await deployment.save({ transaction: blockGroupTransaction });
      } else {
        const predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / (blockRate - lease.price));
        await Lease.update(
          { predictedClosedHeight: predictedClosedHeight.toString() },
          { where: { deploymentId: deployment.id }, transaction: blockGroupTransaction }
        );
      }
    }

    await Bid.destroy({
      where: {
        owner: decodedMessage.bidId.owner,
        dseq: decodedMessage.bidId.dseq.toString(),
        gseq: decodedMessage.bidId.gseq,
        oseq: decodedMessage.bidId.oseq,
        provider: decodedMessage.bidId.provider
      },
      transaction: blockGroupTransaction
    });
  }

  private async handleDepositDeployment(
    decodedMessage: v1beta1.MsgDepositDeployment | v1beta2.MsgDepositDeployment | v1beta3.MsgDepositDeployment,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const deployment = await Deployment.findOne({
      where: {
        owner: decodedMessage.id.owner,
        dseq: decodedMessage.id.dseq.toString()
      },
      include: [
        {
          model: Lease
        }
      ],
      transaction: blockGroupTransaction
    });

    if (!deployment) {
      throw new Error(`Deployment for ${decodedMessage.id.owner}/${decodedMessage.id.dseq.toString()} not found.`);
    }

    msg.relatedDeploymentId = deployment.id;

    deployment.deposit += parseFloat(decodedMessage.amount.amount);
    deployment.balance += parseFloat(decodedMessage.amount.amount);
    await deployment.save({ transaction: blockGroupTransaction });

    const blockRate = deployment.leases
      .filter(x => !x.closedHeight)
      .map(x => x.price)
      .reduce((a, b) => a + b, 0);

    for (const lease of deployment.leases.filter(x => !x.closedHeight)) {
      lease.predictedClosedHeight = Math.ceil((deployment.lastWithdrawHeight || lease.createdHeight) + deployment.balance / blockRate).toString();
      await lease.save({ transaction: blockGroupTransaction });
    }

    msg.amount = getAmountFromCoin(decodedMessage.amount);
  }

  private async handleWithdrawLease(
    decodedMessage: v1beta1.MsgWithdrawLease | v1beta2.MsgWithdrawLease | v1beta3.MsgWithdrawLease | v1beta4.MsgWithdrawLease,
    height: number,
    blockGroupTransaction: DbTransaction,
    msg: Message
  ) {
    const owner = decodedMessage.bidId.owner;
    const dseq = decodedMessage.bidId.dseq.toString();
    const gseq = decodedMessage.bidId.gseq;
    const oseq = decodedMessage.bidId.oseq;
    const provider = decodedMessage.bidId.provider;

    const deployment = await Deployment.findOne({
      where: {
        owner: owner,
        dseq: dseq
      },
      include: [{ model: Lease }],
      transaction: blockGroupTransaction
    });

    if (!deployment) throw new Error(`Deployment not found for owner: ${owner} and dseq: ${dseq}`);

    const lease = deployment.leases.find(x => x.gseq === gseq && x.oseq === oseq && x.providerAddress === provider);

    if (!lease) throw new Error(`Lease not found for gseq: ${gseq}, oseq: ${oseq} and provider: ${provider}`);

    await accountSettle(deployment, height, blockGroupTransaction);

    msg.relatedDeploymentId = deployment.id;
  }

  private async handleCreateProvider(
    decodedMessage: v1beta1.MsgCreateProvider | v1beta2.MsgCreateProvider | v1beta3.MsgCreateProvider,
    height: number,
    blockGroupTransaction: DbTransaction
  ) {
    await Provider.create(
      {
        owner: decodedMessage.owner,
        hostUri: decodedMessage.hostUri,
        createdHeight: height,
        email: decodedMessage.info?.email,
        website: decodedMessage.info?.website
      },
      { transaction: blockGroupTransaction }
    );

    await ProviderAttribute.bulkCreate(
      decodedMessage.attributes.map(attribute => ({
        provider: decodedMessage.owner,
        key: attribute.key,
        value: attribute.value
      })),
      { transaction: blockGroupTransaction }
    );

    this.activeProviderCount++;
  }

  private async handleUpdateProvider(
    decodedMessage: v1beta1.MsgUpdateProvider | v1beta2.MsgUpdateProvider | v1beta3.MsgUpdateProvider,
    height: number,
    blockGroupTransaction: DbTransaction
  ) {
    await Provider.update(
      {
        hostUri: decodedMessage.hostUri,
        updatedHeight: height,
        email: decodedMessage.info?.email,
        website: decodedMessage.info?.website
      },
      {
        where: {
          owner: decodedMessage.owner
        },
        transaction: blockGroupTransaction
      }
    );

    await ProviderAttribute.destroy({
      where: {
        provider: decodedMessage.owner
      },
      transaction: blockGroupTransaction
    });
    await ProviderAttribute.bulkCreate(
      decodedMessage.attributes.map(attribute => ({
        provider: decodedMessage.owner,
        key: attribute.key,
        value: attribute.value
      })),
      { transaction: blockGroupTransaction }
    );
  }

  private async handleDeleteProvider(
    decodedMessage: v1beta1.MsgDeleteProvider | v1beta2.MsgDeleteProvider | v1beta3.MsgDeleteProvider,
    height: number,
    blockGroupTransaction: DbTransaction
  ) {
    await Provider.update(
      {
        deletedHeight: height
      },
      {
        where: { owner: decodedMessage.owner },
        transaction: blockGroupTransaction
      }
    );

    this.activeProviderCount--;
  }

  private async handleSignProviderAttributes(
    decodedMessage: v1beta1.MsgSignProviderAttributes | v1beta2.MsgSignProviderAttributes | v1beta3.MsgSignProviderAttributes,
    height: number,
    blockGroupTransaction: DbTransaction
  ) {
    const provider = await Provider.findOne({ where: { owner: decodedMessage.owner }, transaction: blockGroupTransaction });

    if (!provider) {
      console.warn(`Provider ${decodedMessage.owner} not found`);
      return;
    }

    for (const attribute of decodedMessage.attributes) {
      const existingAttributeSignature = await ProviderAttributeSignature.findOne({
        where: {
          provider: decodedMessage.owner,
          auditor: decodedMessage.auditor,
          key: attribute.key
        },
        transaction: blockGroupTransaction
      });

      if (existingAttributeSignature) {
        await existingAttributeSignature.update(
          {
            value: attribute.value
          },
          { transaction: blockGroupTransaction }
        );
      } else {
        await ProviderAttributeSignature.create(
          {
            provider: decodedMessage.owner,
            auditor: decodedMessage.auditor,
            key: attribute.key,
            value: attribute.value
          },
          { transaction: blockGroupTransaction }
        );
      }
    }
  }

  private async handleDeleteSignProviderAttributes(
    decodedMessage: v1beta1.MsgDeleteProviderAttributes | v1beta2.MsgDeleteProviderAttributes | v1beta3.MsgDeleteProviderAttributes,
    height: number,
    blockGroupTransaction: DbTransaction
  ) {
    if (decodedMessage.keys.length > 0) {
      await ProviderAttributeSignature.destroy({
        where: {
          provider: decodedMessage.owner,
          auditor: decodedMessage.auditor,
          key: { [Op.in]: decodedMessage.keys }
        },
        transaction: blockGroupTransaction
      });
    } else {
      await ProviderAttributeSignature.destroy({
        where: {
          provider: decodedMessage.owner,
          auditor: decodedMessage.auditor
        },
        transaction: blockGroupTransaction
      });
    }
  }

  seed(): Promise<void> {
    return Promise.resolve(undefined);
  }

  async afterEveryTransaction(rawTx: DecodedTxRaw, currentTransaction: Transaction, dbTransaction: DbTransaction, txEvents: TransactionEvent[]): Promise<void> {
    await this.handleMissedClosedDeployments(currentTransaction, dbTransaction, txEvents);
    await this.handleMissedClosedLeases(currentTransaction, dbTransaction, txEvents);
  }

  private async handleMissedClosedDeployments(currentTransaction: Transaction, dbTransaction: DbTransaction, txEvents: TransactionEvent[]) {
    const deploymentClosedEvents = txEvents.filter(
      event => event.type === "akash.v1" && event.attributes.some(attr => attr.key === "action" && attr.value === "deployment-closed")
    );

    for (const deploymentClosedEvent of deploymentClosedEvents) {
      const dseq = deploymentClosedEvent.attributes.find(attr => attr.key === "dseq").value;
      const owner = deploymentClosedEvent.attributes.find(attr => attr.key === "owner").value;

      const deployment = await Deployment.findOne({
        raw: true,
        attributes: ["closedHeight"],
        where: {
          owner,
          dseq
        },
        transaction: dbTransaction
      });

      if (deployment.closedHeight !== currentTransaction.height) {
        await Deployment.update(
          {
            closedHeight: currentTransaction.height
          },
          {
            where: {
              owner,
              dseq
            },
            transaction: dbTransaction
          }
        );
      }
    }
  }

  private async handleMissedClosedLeases(currentTransaction: Transaction, dbTransaction: DbTransaction, txEvents: TransactionEvent[]) {
    const leaseClosedEvents = txEvents.filter(
      event => event.type === "akash.v1" && event.attributes.some(attr => attr.key === "action" && attr.value === "lease-closed")
    );

    for (const event of leaseClosedEvents) {
      const dseq = event.attributes.find(attr => attr.key === "dseq").value;
      const owner = event.attributes.find(attr => attr.key === "owner").value;
      const oseq = event.attributes.find(attr => attr.key === "oseq").value;
      const gseq = event.attributes.find(attr => attr.key === "gseq").value;
      const provider = event.attributes.find(attr => attr.key === "provider").value;

      const lease = await Lease.findOne({
        raw: true,
        attributes: ["closedHeight"],
        where: {
          owner,
          dseq,
          oseq,
          gseq,
          providerAddress: provider
        },
        transaction: dbTransaction
      });

      if (lease.closedHeight !== currentTransaction.height) {
        await Lease.update(
          {
            closedHeight: currentTransaction.height
          },
          {
            where: {
              owner,
              dseq,
              oseq,
              gseq,
              providerAddress: provider
            },
            transaction: dbTransaction
          }
        );
      }
    }
  }
}

function isPersistentStorage(storage: v1beta2.Storage | v1beta3.Storage): boolean {
  return (storage.attributes || []).some(a => a.key === "persistent" && a.value === "true");
}

function getGPUAttributes(gpu: v1beta3.GPU) {
  if (!gpu.attributes || gpu.attributes.length !== 1) return { vendor: null, model: null };

  const attr = gpu.attributes[0];

  if (attr.value !== "true") return { vendor: null, model: null };

  const regex = /^vendor\/(.*)\/model\/(.*)$/;
  const match = attr.key.match(regex);

  if (!match) return { vendor: null, model: null };

  const vendor = match[1]; // "nvidia"
  const model = match[2] != "*" ? match[2] : null; // "a10"

  return { vendor, model };
}
