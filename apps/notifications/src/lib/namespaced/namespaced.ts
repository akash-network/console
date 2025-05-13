import mapKeys from "lodash/mapKeys";

import type { Namespaced } from "@src/lib/types/namespaced-config.type";

export const namespaced = <NS extends string, T extends Record<string, unknown>>(namespace: NS, config: T): Namespaced<NS, T> =>
  mapKeys(config, (_, key) => `${namespace}.${key}`) as Namespaced<NS, T>;
