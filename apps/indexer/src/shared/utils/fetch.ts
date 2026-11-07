import { Agent } from "undici";

import { assertPublicHost, createForbidPrivateNetworkLookup, type NetworkLookup } from "./private-network";

/**
 * Node's global `fetch` typing omits undici's `dispatcher` option, so we widen
 * `RequestInit` to carry the agent used to reach providers that serve
 * self-signed certificates.
 */
type InsecureRequestInit = RequestInit & { dispatcher: Agent };

/** Provider version and status responses are a few kilobytes, so a body past this, counted after decompression, is not one. */
export const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

export function createProviderFetch({
  lookup = createForbidPrivateNetworkLookup(),
  maxResponseBytes = MAX_PROVIDER_RESPONSE_BYTES
}: { lookup?: NetworkLookup; maxResponseBytes?: number } = {}) {
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false, lookup } });

  return async function fetchProvider(url: string, init: RequestInit = {}): Promise<Response> {
    await assertPublicHost(url, lookup);
    const response = await fetch(url, { ...init, redirect: "error", dispatcher } as InsecureRequestInit);

    return limitResponseBody(response, maxResponseBytes);
  };
}

export const fetchAllowingSelfSignedCerts = createProviderFetch();

function limitResponseBody(response: Response, maxBytes: number): Response {
  if (!response.body) return response;

  let receivedBytes = 0;
  const limitedBody = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        receivedBytes += chunk.byteLength;

        if (receivedBytes > maxBytes) {
          controller.error(new Error(`Response body is larger than ${maxBytes} bytes`));
          return;
        }

        controller.enqueue(chunk);
      }
    })
  );

  return new Response(limitedBody, { status: response.status, statusText: response.statusText, headers: response.headers });
}
