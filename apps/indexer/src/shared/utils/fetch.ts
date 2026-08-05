import { Agent } from "undici";

/**
 * Node's global `fetch` typing omits undici's `dispatcher` option, so we widen
 * `RequestInit` to carry the agent used to reach providers that serve
 * self-signed certificates.
 */
type InsecureRequestInit = RequestInit & { dispatcher: Agent };

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

export function fetchAllowingSelfSignedCerts(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, dispatcher: insecureAgent } as InsecureRequestInit);
}
