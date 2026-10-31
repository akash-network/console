import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { AxiosError } from "axios";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

export const SLACK_WEBHOOK_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("SLACK_WEBHOOK_HTTP_CLIENT");

const SLACK_WEBHOOK_TIMEOUT_MS = 10_000;

container.register(SLACK_WEBHOOK_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => {
    const client = createHttpClient({ adapter: "http", timeout: SLACK_WEBHOOK_TIMEOUT_MS });
    client.interceptors.response.use(undefined, rejectWithoutWebhookUrl);

    return client;
  })
});

/** A failed post is rethrown with Slack's answer only, because the webhook URL must stay out of logs and job records. */
function rejectWithoutWebhookUrl(error: AxiosError): Promise<never> {
  const outcome = error.response ? `answered ${error.response.status}: ${error.response.data}` : `failed: ${error.code}`;

  return Promise.reject(new Error(`Slack webhook ${outcome}`));
}
