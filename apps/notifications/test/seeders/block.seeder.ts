import { faker } from "@faker-js/faker";

import type { BlockMessage } from "@src/modules/chain/services/block-message-parser/block-message-parser.service";

/**
 * Generates a simplified mock Block object for testing
 * This avoids TypeScript errors by not trying to match the exact Block type
 */
export function generateSimpleMockBlock(
  options: {
    height?: number;
    id?: string;
    time?: string;
    chainId?: string;
    txCount?: number;
  } = {}
): {
  id: string;
  header: {
    height: number;
    time: string;
    chainId: string;
    version: { block: string; app: string };
  };
  txs: Uint8Array[];
} {
  const height = options.height || faker.number.int({ min: 1, max: 1000000 });
  const txCount = options.txCount || faker.number.int({ min: 0, max: 10 });

  const txs = Array.from({ length: txCount }, () => new Uint8Array(faker.number.int({ min: 10, max: 100 })));

  return {
    id: options.id || faker.string.alphanumeric(64).toLowerCase(),
    header: {
      height,
      time: options.time || faker.date.recent().toISOString(),
      chainId: options.chainId || faker.helpers.arrayElement(["akash-testnet", "akash-mainnet", "akashnet-2"]),
      version: { block: "11", app: "0" }
    },
    txs
  };
}

/**
 * Generates a mock BlockData object for testing
 */
export function generateMockBlockData(
  options: {
    height?: number;
    messageCount?: number;
    messageTypes?: Array<string>;
    time?: string;
    hash?: string;
    messages?: BlockMessage[];
  } = {}
): {
  height: number;
  hash: string;
  time: string;
  messages: BlockMessage[];
} {
  const height = options.height || faker.number.int({ min: 1, max: 1000000 });
  const time = options.time || faker.date.recent().toISOString();

  return {
    height,
    hash: options.hash || faker.string.alphanumeric(64).toLowerCase(),
    time,
    messages: options.messages || []
  };
}
