import { activeChain } from "@akashnetwork/database/chainDefinitions";

import { env } from "@src/shared/utils/env";
import { ProviderVerificationIndexer } from "./providerVerification/providerVerificationIndexer";
import { AkashStatsIndexer } from "./akashStatsIndexer";
import { BmeIndexer } from "./bmeIndexer";
import type { Indexer } from "./indexer";
import { MessageAddressesIndexer } from "./messageAddressesIndexer";
import { ValidatorIndexer } from "./validatorIndexer";

const validatorIndexer = new ValidatorIndexer();
const messageAddressesIndexer = new MessageAddressesIndexer();
const customIndexers = [new AkashStatsIndexer(), new BmeIndexer(), ...(env.PROVIDER_VERIFICATION_ENABLED ? [new ProviderVerificationIndexer()] : [])].filter(
  x => activeChain.customIndexers.includes(x.name)
);

export const indexers: Indexer[] = activeChain.startHeight
  ? [...customIndexers, messageAddressesIndexer]
  : [...customIndexers, validatorIndexer, messageAddressesIndexer];
export const activeIndexers = [...indexers];
export const indexersMsgTypes = activeIndexers.reduce<string[]>((previous, current) => previous.concat(Object.keys(current.msgHandlers)), []);
