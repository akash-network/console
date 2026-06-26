import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CONFIDENTIAL_COMPUTE_CONFIG } from "./config.provider";

/** axios client for AMD KDS (VCEK + ARK/ASK cert chain). */
export const AMD_KDS_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("AMD_KDS_HTTP_CLIENT");
/** axios client for the NVIDIA Remote Attestation Service. */
export const NVIDIA_NRAS_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("NVIDIA_NRAS_HTTP_CLIENT");
/** axios client for Intel Trust Authority. */
export const INTEL_ITA_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("INTEL_ITA_HTTP_CLIENT");

// Every attestation request waits on these external vendor services on the request path. Cap each call so a
// stalled vendor degrades the report to `unverifiable` quickly instead of hanging the request until an upstream
// proxy times out.
const VENDOR_HTTP_TIMEOUT_MS = 10_000;

container.register(AMD_KDS_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createHttpClient({ baseURL: c.resolve(CONFIDENTIAL_COMPUTE_CONFIG).AMD_KDS_BASE_URL, adapter: "http", timeout: VENDOR_HTTP_TIMEOUT_MS })
  )
});

container.register(NVIDIA_NRAS_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createHttpClient({ baseURL: c.resolve(CONFIDENTIAL_COMPUTE_CONFIG).NVIDIA_NRAS_BASE_URL, adapter: "http", timeout: VENDOR_HTTP_TIMEOUT_MS })
  )
});

container.register(INTEL_ITA_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createHttpClient({ baseURL: c.resolve(CONFIDENTIAL_COMPUTE_CONFIG).INTEL_ITA_BASE_URL, adapter: "http", timeout: VENDOR_HTTP_TIMEOUT_MS })
  )
});
