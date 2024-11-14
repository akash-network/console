import "@src/utils/protobuf";

import { getAkashTypeRegistry } from "@akashnetwork/akashjs/build/stargate";
import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { container, inject } from "tsyringe";

const registry = new Registry([...defaultRegistryTypes, ...getAkashTypeRegistry()]);

export const TYPE_REGISTRY = "TYPE_REGISTRY";

container.register(TYPE_REGISTRY, { useValue: registry });
export const InjectTypeRegistry = () => inject(TYPE_REGISTRY);
