import * as v1beta1 from "@akashnetwork/akash-api/v1beta1";
import * as v1beta2 from "@akashnetwork/akash-api/v1beta2";
import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as prevV1beta4 from "@akashnetwork/akash-api/v1beta4";
import * as v1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import * as v1beta4 from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import * as v1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import * as cosmosv1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1";
import * as cosmosv1alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1alpha1";
import * as cosmosv1beta1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import * as cosmosv2alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v2alpha1";
import type { GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes as stargateDefaultRegistryTypes } from "@cosmjs/stargate";
import { omit } from "lodash";
import type { InjectionToken } from "tsyringe";
import { container, inject } from "tsyringe";

type DefaultRegistryType = [string, GeneratedType];
const ibcTypes: DefaultRegistryType[] = stargateDefaultRegistryTypes.filter(([type]) => type.startsWith("/ibc"));
const defaultRegistryTypes: DefaultRegistryType[] = [
  ...Object.values(cosmosv1),
  ...Object.values(cosmosv1beta1),
  ...Object.values(cosmosv1alpha1),
  ...Object.values(cosmosv2alpha1)
]
  .filter(x => x && "$type" in x)
  .map(x => ["/" + x.$type, x as unknown as GeneratedType])
  .concat(ibcTypes) as DefaultRegistryType[];

const akashTypes: ReadonlyArray<[string, GeneratedType]> = [
  ...Object.values(v1beta1),
  ...Object.values(omit(v1beta2, "Storage")),
  ...Object.values(omit(v1beta3, ["DepositDeploymentAuthorization", "GPU"])),
  ...Object.values(prevV1beta4)
].map(x => ["/" + x.$type, x]);

const newAkashTypes: ReadonlyArray<[string, GeneratedType]> = [...Object.values(v1), ...Object.values(v1beta4), ...Object.values(v1beta5)]
  .filter(x => "$type" in x)
  .map(x => ["/" + x.$type, x as unknown as GeneratedType]);

const registry = new Registry([...defaultRegistryTypes, ...akashTypes, ...newAkashTypes]);

export const TYPE_REGISTRY: InjectionToken<Registry> = Symbol("TYPE_REGISTRY");
export type { Registry };

container.register(TYPE_REGISTRY, { useValue: registry });
export const InjectTypeRegistry = () => inject(TYPE_REGISTRY);
