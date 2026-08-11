import type { FeeCoin } from "@src/db/schema";

export interface DecodedMessage {
  index: number;
  typeUrl: string;
  body: unknown | null;
}

export interface DecodedTransaction {
  index: number;
  hash: Buffer;
  code: number;
  gasUsed: number;
  gasWanted: number;
  fee: FeeCoin[];
  messages: DecodedMessage[];
}

export interface DecodedBlock {
  height: number;
  datetime: Date;
  hash: Buffer;
  parentHash: Buffer | null;
  proposerAddress: string;
  transactions: DecodedTransaction[];
}
