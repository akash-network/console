import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { FEEDBACK_CONFIG } from "./config.provider";

export const TYPESAFE_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("TYPESAFE_HTTP_CLIENT");

export const TYPESAFE_TIMEOUT_MS = 30_000;

container.register(TYPESAFE_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const { TYPESAFE_API_URL, TYPESAFE_API_KEY } = c.resolve(FEEDBACK_CONFIG);

    return createHttpClient({
      baseURL: TYPESAFE_API_URL,
      adapter: "http",
      timeout: TYPESAFE_TIMEOUT_MS,
      headers: TYPESAFE_API_KEY ? { Authorization: `Bearer ${TYPESAFE_API_KEY}` } : {}
    });
  })
});
