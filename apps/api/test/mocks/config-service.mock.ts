import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import type { z } from "zod";

import type { ConfigService } from "@src/core/services/config/config.service";

type EnvOf<T> = T extends ConfigService<infer E, any> ? z.infer<E> : never;
type AppCfgOf<T> = T extends ConfigService<any, infer C> ? C : never;
type ConfigOf<T> = EnvOf<T> & AppCfgOf<T>;

/**
 * Creates a mock for a ConfigService subclass.
 * You can pass a partial map of config keys to values; `get(key)` will return those.
 * If a key isn't provided, the mock will throw (fail fast in tests).
 */
export const mockConfigService = <T extends ConfigService<any, any>>(values: Partial<ConfigOf<T>> = {}): MockProxy<T> => {
  const svc = mock<T>();

  (svc.get as unknown as jest.MockedFunction<(key: keyof ConfigOf<T>) => any>).mockImplementation(key => {
    if (key in values) return (values as ConfigOf<T>)[key];
    throw new Error(`Missing mock for config key "${String(key)}" in ${svc.constructor?.name ?? "ConfigService"}`);
  });

  return svc;
};
