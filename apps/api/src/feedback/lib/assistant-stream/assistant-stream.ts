import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import type { RunAssistantTurn } from "@src/feedback/services/assistant-conversation/assistant-conversation.service";

/** Proxies in front of the API (the console's Next.js compression, ingress-nginx, Cloudflare) hold back a stream unless it opts out of transforms and buffering. */
const UNBUFFERED_STREAM_HEADERS = { "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" };

/** Every refusal is decided before this is called, so a stream that starts always carries the turn's own events, ending with `done` or `error`. */
export function streamAssistantTurn(c: Context, run: RunAssistantTurn): Response {
  const response = streamSSE(c, async stream => {
    await run(async event => {
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    }, c.req.raw.signal);
  });
  Object.entries(UNBUFFERED_STREAM_HEADERS).forEach(([name, value]) => response.headers.set(name, value));

  return response;
}
