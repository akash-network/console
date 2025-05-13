import { registerAs } from "@nestjs/config";

import type { BrokerEnvConfig } from "@src/infrastructure/broker/config/env.config";
import { schema } from "@src/infrastructure/broker/config/env.config";
import type { Namespaced } from "@src/lib/types/namespaced-config.type";

export const NAMESPACE = "broker" as const;

export type BrokerConfig = Namespaced<typeof NAMESPACE, BrokerEnvConfig>;
export default registerAs(NAMESPACE, () => schema.parse(process.env));
