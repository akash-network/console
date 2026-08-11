import type { z, ZodEffects, ZodObject, ZodRawShape } from "zod";

interface ConfigServiceOptions<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, unknown>> {
  config?: [C] extends [Record<string, never>] ? z.infer<E> : z.infer<E> & C;
}

export class ConfigService<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, unknown> = Record<string, never>> {
  readonly #config: C & z.infer<E>;

  constructor(options: ConfigServiceOptions<E, C>) {
    this.#config = {
      ...options.config
    } as C & z.infer<E>;
  }

  get<K extends keyof (C & z.infer<E>)>(key: K): (C & z.infer<E>)[K] {
    return this.#config[key];
  }
}
