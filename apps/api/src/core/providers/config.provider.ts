import { container } from "tsyringe";

import { config } from "@src/core/config";

export const CORE_CONFIG = "CORE_CONFIG";

container.register(CORE_CONFIG, { useValue: config });

export type CoreConfig = typeof config;
