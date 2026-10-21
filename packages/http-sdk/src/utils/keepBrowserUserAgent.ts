import type { RawAxiosRequestHeaders } from "axios";

/** axios's fetch adapter sets its own User-Agent, which Firefox sends and lists in CORS preflights that chain nodes reject. */
export function keepBrowserUserAgent(): RawAxiosRequestHeaders {
  return "window" in globalThis ? { "User-Agent": false } : {};
}
