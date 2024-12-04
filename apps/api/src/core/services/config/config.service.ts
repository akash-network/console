import { z, ZodObject, ZodRawShape } from "zod";

interface ConfigServiceOptions<E extends ZodObject<ZodRawShape>, C extends Record<string, any>> {
  envSchema?: E;
  config?: C;
}

export class ConfigService<E extends ZodObject<ZodRawShape>, C extends Record<string, any>> {
  private readonly config: C & z.infer<E>;

  constructor(options: ConfigServiceOptions<E, C>) {
    this.config = {
      ...options.config,
      ...options.envSchema?.parse(process.env)
    };
  }

  get<K extends keyof typeof this.config>(key: K): (typeof this.config)[K] {
    return this.config[key];
  }
}
