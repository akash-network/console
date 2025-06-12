import type { z, ZodEffects, ZodObject, ZodRawShape } from "zod";

interface ConfigServiceOptions<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, any>> {
  envSchema?: E;
  config?: C;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export class ConfigService<E extends ZodObject<ZodRawShape> | ZodEffects<ZodObject<ZodRawShape>>, C extends Record<string, any> = {}> {
  private readonly config: C & z.infer<E>;

  constructor(options: ConfigServiceOptions<E, C>) {
    this.config = {
      ...options.config,
      ...options.envSchema?.parse(process.env)
    } as C & z.infer<E>;
  }

  get<K extends keyof typeof this.config>(key: K): (typeof this.config)[K] {
    return this.config[key];
  }
}
