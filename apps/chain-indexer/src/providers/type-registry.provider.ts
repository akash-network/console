import { Registry } from "@cosmjs/proto-signing";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import { registeredProtoTypes } from "@src/proto/type-catalog";

const registry = new Registry(registeredProtoTypes);

export const TYPE_REGISTRY: InjectionToken<Registry> = Symbol("TYPE_REGISTRY");
export type { Registry };

container.register(TYPE_REGISTRY, { useValue: registry });
