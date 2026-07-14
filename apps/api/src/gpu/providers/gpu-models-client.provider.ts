import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

/** Directory of the provider-configs GPU catalog; the supported models per vendor live in `gpus.json`. */
const GPU_MODELS_BASE_URL = "https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie";

/** Caps the external GitHub catalog fetch so a stalled request fails fast instead of hanging (the client's retries would otherwise compound the delay). */
const GPU_MODELS_HTTP_TIMEOUT_MS = 10_000;

/** axios client for the provider-configs GPU model catalog. */
export const GPU_MODELS_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("GPU_MODELS_HTTP_CLIENT");

container.register(GPU_MODELS_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => createHttpClient({ baseURL: GPU_MODELS_BASE_URL, adapter: "http", timeout: GPU_MODELS_HTTP_TIMEOUT_MS }))
});
