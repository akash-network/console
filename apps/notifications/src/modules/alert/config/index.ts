import { registerAs } from "@nestjs/config";

import type { Namespaced } from "@src/lib/types/namespaced-config.type";
import type { AlertEnvConfig } from "./env.config";
import { schema } from "./env.config";

const NAMESPACE = "alert" as const;

export type AlertConfig = Namespaced<typeof NAMESPACE, AlertEnvConfig>;

export default registerAs(NAMESPACE, () => schema.parse(process.env));
