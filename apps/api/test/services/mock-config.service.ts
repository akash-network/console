import { mock, type MockProxy } from "vitest-mock-extended";
import type { z, ZodEffects, ZodObject, ZodRawShape } from "zod";

import type { ConfigService } from "@src/core/services/config/config.service";

type EnvLike = ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>;

type ConfigOf<S> = S extends ConfigService<infer E extends EnvLike, infer C extends Record<string, unknown>> ? z.infer<E> & C : never;

export function mockConfig<S extends ConfigService<EnvLike, Record<string, unknown>>>(config: Partial<ConfigOf<S>>): MockProxy<S> {
  const svc = mock<S>();
  type K = keyof ConfigOf<S>;
  const getMock = svc.get as unknown as jest.MockedFunction<(key: K) => ConfigOf<S>[K]>;
  getMock.mockImplementation(key => config[key] as ConfigOf<S>[typeof key]);

  return svc;
}
