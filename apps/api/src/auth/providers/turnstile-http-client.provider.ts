import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

export const TURNSTILE_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("TURNSTILE_HTTP_CLIENT");

const TURNSTILE_TIMEOUT_MS = 10_000;

container.register(TURNSTILE_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => createHttpClient({ adapter: "http", timeout: TURNSTILE_TIMEOUT_MS, maxRedirects: 0 }))
});
