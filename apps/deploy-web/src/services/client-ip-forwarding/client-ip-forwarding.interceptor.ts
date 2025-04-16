import type { InternalAxiosRequestConfig } from "axios";

import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";

const headerNames = ["cf-connecting-ip", "x-forwarded-for"];
export function clientIpForwardingInterceptor(config: InternalAxiosRequestConfig) {
  const context = requestExecutionContext.getStore();

  if (!context) {
    console.error("No request headers found in async local storage. Looses original client IP address.", config.url, new Error().stack);
    return config;
  }

  headerNames.forEach(name => {
    const value = context.headers.get(name);
    if (value) config.headers.set(name, value);
  });

  return config;
}
