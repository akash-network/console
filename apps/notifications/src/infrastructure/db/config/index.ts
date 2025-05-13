import { registerAs } from "@nestjs/config";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import type { DbEnvConfig } from "@src/infrastructure/db/config/env.config";
import { schema } from "@src/infrastructure/db/config/env.config";
import type { Namespaced } from "@src/lib/types/namespaced-config.type";

const NAMESPACE = "db" as const;

export type DbConfig = Namespaced<typeof NAMESPACE, DbEnvConfig>;
export default registerAs(NAMESPACE, () => ({
  DRIZZLE_PROVIDER_TOKEN,
  ...schema.parse(process.env)
}));
