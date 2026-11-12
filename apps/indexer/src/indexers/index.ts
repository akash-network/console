import { activeChain } from "@akashnetwork/database/chainDefinitions";

import { createBlockResultsReader } from "@src/chain/blockResultsReader";
import { blockHeightToKey, blockResultsDb, getCachedBlockResultsByHeight } from "@src/chain/dataStore";
import { nodeAccessor } from "@src/chain/nodeAccessor";
import { AkashStatsIndexer } from "./akashStatsIndexer";
import { BmeIndexer } from "./bmeIndexer";
import type { Indexer } from "./indexer";
import { MessageAddressesIndexer } from "./messageAddressesIndexer";
import { SinkIndexer } from "./sinkIndexer";
import { ValidatorIndexer } from "./validatorIndexer";

const validatorIndexer = new ValidatorIndexer();
const messageAddressesIndexer = new MessageAddressesIndexer();
const readBlockResults = createBlockResultsReader({
  findCachedBlockResults: getCachedBlockResultsByHeight,
  downloadBlockResults: async height => (await nodeAccessor.getBlockResult(height)).result,
  cacheBlockResults: (height, blockResults) => blockResultsDb.put(blockHeightToKey(height), JSON.stringify(blockResults))
});
const customIndexers = [new AkashStatsIndexer(), new BmeIndexer(), new SinkIndexer(readBlockResults)].filter(x => activeChain.customIndexers.includes(x.name));

export const indexers: Indexer[] = activeChain.startHeight
  ? [...customIndexers, messageAddressesIndexer]
  : [...customIndexers, validatorIndexer, messageAddressesIndexer];
export const activeIndexers = [...indexers];
export const indexersMsgTypes = activeIndexers.reduce<string[]>((previous, current) => previous.concat(Object.keys(current.msgHandlers)), []);
