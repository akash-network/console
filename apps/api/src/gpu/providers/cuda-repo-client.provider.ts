import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

const CUDA_REPO_BASE_URL = "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64";

/** Caps the listing fetch so a cold cache holds the provider page it decorates for at most this long. */
const CUDA_REPO_HTTP_TIMEOUT_MS = 5_000;

export const CUDA_REPO_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("CUDA_REPO_HTTP_CLIENT");

container.register(CUDA_REPO_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => createHttpClient({ baseURL: CUDA_REPO_BASE_URL, adapter: "http", timeout: CUDA_REPO_HTTP_TIMEOUT_MS }))
});
