import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import type { RunAssistantTurn } from "@src/feedback/services/assistant-conversation/assistant-conversation.service";

/** Every refusal is decided before this is called, so a stream that starts always carries the turn's own events, ending with `done` or `error`. */
export function streamAssistantTurn(c: Context, run: RunAssistantTurn): Response {
  return streamSSE(c, async stream => {
    await run(async event => {
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    }, c.req.raw.signal);
  });
}
