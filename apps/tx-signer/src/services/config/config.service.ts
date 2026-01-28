import type { z, ZodEffects, ZodObject, ZodRawShape } from "zod";

interface ConfigServiceOptions<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, unknown>> {
  config?: z.infer<E> & C;
}

export class ConfigService<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, unknown> = Record<string, never>> {
  private readonly config: C & z.infer<E>;

  constructor(options: ConfigServiceOptions<E, C>) {
    this.config = {
      ...options.config
    } as C & z.infer<E>;
  }

  get<K extends keyof typeof this.config>(key: K): (typeof this.config)[K] {
    return this.config[key];
  }
}
