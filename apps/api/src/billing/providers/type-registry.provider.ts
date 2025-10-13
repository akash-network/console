import "@src/utils/protobuf";

import * as v1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import * as v1beta4 from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import * as v1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import * as cosmosv1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1";
import * as cosmosv1alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1alpha1";
import * as cosmosv1beta1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import * as cosmosv2alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v2alpha1";
import type { GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import type { InjectionToken } from "tsyringe";
import { container, inject } from "tsyringe";

const newAkashTypes: ReadonlyArray<[string, GeneratedType]> = [
  ...Object.values(v1),
  ...Object.values(v1beta4),
  ...Object.values(v1beta5),
  ...Object.values(cosmosv1),
  ...Object.values(cosmosv1beta1),
  ...Object.values(cosmosv1alpha1),
  ...Object.values(cosmosv2alpha1)
]
  .filter(x => "$type" in x)
  .map(x => ["/" + x.$type, x as unknown as GeneratedType]);

const registry = new Registry(newAkashTypes);

export const TYPE_REGISTRY: InjectionToken<Registry> = "TYPE_REGISTRY";

container.register(TYPE_REGISTRY, { useValue: registry });
export const InjectTypeRegistry = () => inject(TYPE_REGISTRY);
