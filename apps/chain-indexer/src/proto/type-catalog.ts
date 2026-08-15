import * as legacyV1beta1 from "@akashnetwork/akash-api/v1beta1";
import * as legacyV1beta2 from "@akashnetwork/akash-api/v1beta2";
import * as legacyV1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as legacyV1beta4 from "@akashnetwork/akash-api/v1beta4";
import * as akashV1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import * as akashV1beta1 from "@akashnetwork/chain-sdk/private-types/akash.v1beta1";
import * as akashV1beta4 from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import * as akashV1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import * as akashV2 from "@akashnetwork/chain-sdk/private-types/akash.v2";
import * as cosmosV1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1";
import * as cosmosV1alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1alpha1";
import * as cosmosV1beta1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import * as cosmosV2alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v2alpha1";
import type { GeneratedType } from "@cosmjs/proto-signing";
import { defaultRegistryTypes as stargateDefaultRegistryTypes } from "@cosmjs/stargate";

/**
 * Every `index.akash.*` proto module of the installed chain SDK, keyed by module basename.
 * `akash-type-coverage.spec.ts` asserts this map stays in lockstep with the SDK's dist folder,
 * so an SDK bump that ships a new Akash proto module cannot merge without being added here
 * (registered) or listed in the ignore set.
 */
export const AKASH_SDK_MODULES: Readonly<Record<string, object>> = {
  "akash.v1": akashV1,
  "akash.v1beta1": akashV1beta1,
  "akash.v1beta4": akashV1beta4,
  "akash.v1beta5": akashV1beta5,
  "akash.v2": akashV2
};

/**
 * Historical Akash proto versions that no longer ship in the chain SDK but still appear in
 * mainnet history. Decoding them from the frozen legacy package keeps backfilled message
 * bodies populated instead of dead-lettering types we already know about.
 */
const LEGACY_AKASH_MODULES: readonly object[] = [legacyV1beta1, legacyV1beta2, legacyV1beta3, legacyV1beta4];

const COSMOS_SDK_MODULES: readonly object[] = [cosmosV1, cosmosV1beta1, cosmosV1alpha1, cosmosV2alpha1];

/**
 * Message families the indexer deliberately does not decode: their bodies are stored as null
 * without dead-lettering. Every entry needs a reason here, and the exact-match set is checked
 * against the installed SDK by `akash-type-coverage.spec.ts` so stale entries fail CI.
 *
 * - `/cosmwasm.`: cosmwasm runs on sandbox only and no consumer reads contract call bodies yet.
 */
export const IGNORED_TYPE_URL_PREFIXES: readonly string[] = ["/cosmwasm."];

export const IGNORED_TYPE_URLS: ReadonlySet<string> = new Set();

export function isIgnoredTypeUrl(typeUrl: string): boolean {
  return IGNORED_TYPE_URLS.has(typeUrl) || IGNORED_TYPE_URL_PREFIXES.some(prefix => typeUrl.startsWith(prefix));
}

function collectTypePairs(module: object): Array<[string, GeneratedType]> {
  return Object.values(module).flatMap(value =>
    value !== null && typeof value === "object" && "$type" in value && typeof value.$type === "string"
      ? [["/" + value.$type, value as unknown as GeneratedType] as [string, GeneratedType]]
      : []
  );
}

/** First registration wins, so the chain SDK's codegen takes precedence over the legacy package where versions overlap (e.g. deployment v1beta4). */
function dedupeFirstWins(groups: ReadonlyArray<ReadonlyArray<[string, GeneratedType]>>): Array<[string, GeneratedType]> {
  const byTypeUrl = new Map<string, GeneratedType>();

  for (const pairs of groups) {
    for (const [typeUrl, type] of pairs) {
      if (!byTypeUrl.has(typeUrl)) {
        byTypeUrl.set(typeUrl, type);
      }
    }
  }

  return [...byTypeUrl.entries()];
}

const ibcTypes: Array<[string, GeneratedType]> = stargateDefaultRegistryTypes.filter(([type]) => type.startsWith("/ibc"));

/** Everything the block decoder can decode, deduped by typeUrl. The registry provider turns this into the cosmjs Registry. */
export const registeredProtoTypes: ReadonlyArray<[string, GeneratedType]> = dedupeFirstWins([
  ...Object.values(AKASH_SDK_MODULES).map(collectTypePairs),
  ...COSMOS_SDK_MODULES.map(collectTypePairs),
  ibcTypes,
  ...LEGACY_AKASH_MODULES.map(collectTypePairs)
]);
