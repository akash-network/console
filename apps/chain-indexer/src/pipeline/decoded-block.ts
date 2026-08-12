import type { FeeCoin } from "@src/db/schema";

export interface DecodedMessage {
  index: number;
  typeUrl: string;
  body: unknown | null;
}

/** An ABCI event with base64-normalized attributes flattened to a key→value map. `msgIndex` links the event to its message where present. */
export interface DecodedEvent {
  type: string;
  attributes: Record<string, string>;
  msgIndex?: number;
}

export interface DecodedTransaction {
  index: number;
  hash: Buffer;
  code: number;
  gasUsed: number;
  gasWanted: number;
  fee: FeeCoin[];
  messages: DecodedMessage[];
  events: DecodedEvent[];
  signerAddresses: string[];
}

export interface DecodedBlock {
  height: number;
  datetime: Date;
  hash: Buffer;
  parentHash: Buffer | null;
  proposerAddress: string;
  transactions: DecodedTransaction[];
  blockEvents: DecodedEvent[];
}
