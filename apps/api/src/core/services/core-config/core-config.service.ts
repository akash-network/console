import { singleton } from "tsyringe";

import { envSchema } from "../../config/env.config";
import { ConfigService } from "../config/config.service";

@singleton()
export class CoreConfigService extends ConfigService<typeof envSchema> {
  constructor() {
    super({ envSchema });
  }
}
