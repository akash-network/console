import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { FEEDBACK_CONFIG } from "./config.provider";

export const AKASHML_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("AKASHML_HTTP_CLIENT");

export const AKASHML_TIMEOUT_MS = 60_000;

container.register(AKASHML_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const { AKASHML_API_URL, AKASHML_API_KEY } = c.resolve(FEEDBACK_CONFIG);

    return createHttpClient({
      baseURL: AKASHML_API_URL,
      adapter: "http",
      timeout: AKASHML_TIMEOUT_MS,
      headers: AKASHML_API_KEY ? { Authorization: `Bearer ${AKASHML_API_KEY}` } : {}
    });
  })
});
