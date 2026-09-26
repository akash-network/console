import type { EnvConfig } from "@src/config/env.config";
import { apiHandlers, healthzRouter, statusRouter } from "@src/routes";

/** Every process answers health and status; the query routes stay on the api role, whose sessions are read-only and time-bounded. */
const runtimeHandlers = [healthzRouter, statusRouter];

export function handlersForRole(role: EnvConfig["INDEXER_ROLE"]): typeof apiHandlers {
  return role === "api" ? apiHandlers : runtimeHandlers;
}
