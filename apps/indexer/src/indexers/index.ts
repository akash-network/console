import { activeChain } from "@akashnetwork/database/chainDefinitions";

import { AkashStatsIndexer } from "./akashStatsIndexer";
import { Indexer } from "./indexer";
import { MessageAddressesIndexer } from "./messageAddressesIndexer";
import { ValidatorIndexer } from "./validatorIndexer";

const validatorIndexer = new ValidatorIndexer();
const messageAddressesIndexer = new MessageAddressesIndexer();
const customIndexers = [new AkashStatsIndexer()].filter(x => activeChain.customIndexers.includes(x.name));

export const indexers: Indexer[] = activeChain.startHeight
  ? [...customIndexers, messageAddressesIndexer]
  : [...customIndexers, validatorIndexer, messageAddressesIndexer];
export const activeIndexers = [...indexers];
export const indexersMsgTypes: string[] = activeIndexers.reduce((previous, current) => previous.concat(Object.keys(current.msgHandlers)), []);
