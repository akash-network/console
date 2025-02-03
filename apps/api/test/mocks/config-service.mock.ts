import { z } from "zod";

import { ConfigService } from "@src/core/services/config/config.service";

export class MockConfigService<T extends Record<string, unknown>> extends ConfigService<z.ZodObject<z.ZodRawShape>, T> {
  constructor(values: T) {
    super({ config: values });
  }

  override get<K extends string | number | keyof T>(key: K): (T & { [x: string]: unknown })[K] {
    return super.get(key);
  }
}
