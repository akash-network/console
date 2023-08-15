import { DecodedTxRaw } from "@cosmjs/proto-signing";
import { IGenesis } from "@src/chain/genesisTypes";
import { Block, Message, Transaction } from "@shared/dbSchemas/base";
import * as benchmark from "@src/shared/utils/benchmark";

export abstract class Indexer {
  name: string;
  msgHandlers: { [key: string]: (msgSubmitProposal: any, height: number, blockGroupTransaction, msg: Message) => Promise<void> };
  runForEveryBlocks: boolean;
  processFailedTxs: boolean;

  public initCache(firstBlockHeight: number): Promise<void> {
    return Promise.resolve();
  }
  hasHandlerForType(type: string): boolean {
    return Object.keys(this.msgHandlers).includes(type);
  }
  async processMessage(decodedMessage: any, height: number, blockGroupTransaction, msg: Message): Promise<void> {
    if (!(msg.type in this.msgHandlers)) {
      throw new Error(`No handler for message type ${msg.type} in ${this.name}`);
    }
    await benchmark.measureAsync(this.name + " " + msg.type, async () => {
      await this.msgHandlers[msg.type].bind(this)(decodedMessage, height, blockGroupTransaction, msg);
    });
  }
  dropTables(): Promise<void> {
    return Promise.resolve();
  }
  createTables(): Promise<void> {
    return Promise.resolve();
  }
  async recreateTables(): Promise<void> {
    await this.dropTables();
    await this.createTables();
  }
  seed(genesis: IGenesis): Promise<void> {
    return Promise.resolve();
  }
  afterEveryBlock(currentBlock: Block, previousBlock: Block, dbTransaction): Promise<void> {
    return Promise.resolve();
  }
  afterEveryTransaction(rawTx: DecodedTxRaw, currentTransaction: Transaction, dbTransaction): Promise<void> {
    return Promise.resolve();
  }
}
