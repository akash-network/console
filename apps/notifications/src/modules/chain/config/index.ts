import { registerAs } from "@nestjs/config";
import type { BackoffOptions } from "exponential-backoff";

import type { Namespaced } from "@src/lib/types/namespaced-config.type";
import type { ChainEventsEnvConfig } from "./env.config";
import { schema } from "./env.config";
import { pollingConfig } from "./polling.config";

export const NAMESPACE = "chain" as const;
export type ChainEventsConfig = Namespaced<
  typeof NAMESPACE,
  ChainEventsEnvConfig & {
    pollingConfig: BackoffOptions;
  }
>;
export default registerAs(NAMESPACE, () => ({
  ...schema.parse(process.env),
  pollingConfig
}));
