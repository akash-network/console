import * as v1 from "@akashnetwork/chain-sdk/private-types/akash.v1";
import * as v1beta4 from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import * as v1beta5 from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import * as cosmosv1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1";
import * as cosmosv1alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1alpha1";
import * as cosmosv1beta1 from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import * as cosmosv2alpha1 from "@akashnetwork/chain-sdk/private-types/cosmos.v2alpha1";
import type { GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import type { Provider } from "@nestjs/common";

export const RegistryProvider: Provider<Registry> = {
  provide: Registry,
  useFactory: () => {
    const modules: ReadonlyArray<Record<string, unknown>> = [v1, v1beta4, v1beta5, cosmosv1, cosmosv1beta1, cosmosv1alpha1, cosmosv2alpha1];
    const akashTypes: ReadonlyArray<[string, GeneratedType]> = modules
      .flatMap(module => Object.values(module))
      .filter(hasType)
      .map(type => ["/" + type.$type, type as unknown as GeneratedType]);

    return new Registry(akashTypes);
  }
};

function hasType(value: unknown): value is { $type: string } {
  return typeof value === "object" && value !== null && "$type" in value && typeof value.$type === "string";
}
