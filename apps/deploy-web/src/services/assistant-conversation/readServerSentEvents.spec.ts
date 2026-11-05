import { describe, expect, it } from "vitest";

import { readServerSentEvents } from "./readServerSentEvents";

describe(readServerSentEvents.name, () => {
  it("yields each event with its name and data", async () => {
    const events = await readAll(['event: text_delta\ndata: {"text":"Hi"}\n\n', 'event: done\ndata: {"reason":"stop"}\n\n']);

    expect(events).toEqual([
      { event: "text_delta", data: '{"text":"Hi"}' },
      { event: "done", data: '{"reason":"stop"}' }
    ]);
  });

  it("joins an event split across chunks, even inside a multi-byte character", async () => {
    const bytes = new TextEncoder().encode('event: text_delta\ndata: {"text":"café"}\n\n');
    const splitAt = bytes.indexOf(0xc3) + 1;

    const events = await readAll([bytes.slice(0, 10), bytes.slice(10, splitAt), bytes.slice(splitAt)]);

    expect(events).toEqual([{ event: "text_delta", data: '{"text":"café"}' }]);
  });

  it("reads events separated by carriage returns", async () => {
    const events = await readAll(["event: done\r\ndata: {}\r\n\r\nevent: error\r\ndata: {}\r\n\r\n"]);

    expect(events.map(event => event.event)).toEqual(["done", "error"]);
  });

  it("joins multi-line data with line breaks and drops one leading space only", async () => {
    const events = await readAll(["data:  first\ndata:second\n\n"]);

    expect(events).toEqual([{ event: "message", data: " first\nsecond" }]);
  });

  it("skips comments, fields it does not know and blocks without data", async () => {
    const events = await readAll([": keep-alive\n\nid: 7\nevent: ping\n\nretry: 10\nevent: done\ndata\n\n"]);

    expect(events).toEqual([{ event: "done", data: "" }]);
  });

  it("yields a last event the stream ends without terminating", async () => {
    const events = await readAll(["event: done\ndata: {}"]);

    expect(events).toEqual([{ event: "done", data: "{}" }]);
  });

  it("yields nothing for an empty stream", async () => {
    expect(await readAll([])).toEqual([]);
  });

  async function readAll(chunks: Array<string | Uint8Array>) {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk));
        controller.close();
      }
    });
    const events = [];
    for await (const event of readServerSentEvents(body)) events.push(event);
    return events;
  }
});
