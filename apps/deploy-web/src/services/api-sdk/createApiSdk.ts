import type { paths } from "@akashnetwork/console-api-types";
import { operations } from "@akashnetwork/console-api-types";
import { createApi } from "@akashnetwork/openapi-sdk";

export function createApiSdk(config: { baseUrl: string; fetch?: typeof fetch; defaultHeaders?: Record<string, string> }) {
  return createApi<paths, typeof operations>(operations, config);
}
