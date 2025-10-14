import * as v1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import * as v1beta4 from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import * as v1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";

const akashTypes: ReadonlyArray<[string, GeneratedType]> = [...Object.values(v1), ...Object.values(v1beta4), ...Object.values(v1beta5)]
  .filter(x => "$type" in x)
  .map(x => ["/" + x.$type, x as unknown as GeneratedType]);

export const registry = new Registry([...akashTypes]);
