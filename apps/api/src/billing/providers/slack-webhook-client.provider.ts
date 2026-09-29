import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

export const SLACK_WEBHOOK_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("SLACK_WEBHOOK_HTTP_CLIENT");

const SLACK_WEBHOOK_TIMEOUT_MS = 10_000;

container.register(SLACK_WEBHOOK_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => createHttpClient({ adapter: "http", timeout: SLACK_WEBHOOK_TIMEOUT_MS }))
});
