export interface ServerSentEvent {
  event: string;
  data: string;
}

const EVENT_SEPARATOR = "\n\n";

/** Reads a `text/event-stream` body as it arrives, yielding each event once its blank-line terminator is in. */
export async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffered = normalizeLineBreaks(buffered + decoder.decode(value, { stream: !done }));

      let separatorAt = buffered.indexOf(EVENT_SEPARATOR);
      while (separatorAt !== -1) {
        const event = parseEventBlock(buffered.slice(0, separatorAt));
        buffered = buffered.slice(separatorAt + EVENT_SEPARATOR.length);
        if (event) yield event;
        separatorAt = buffered.indexOf(EVENT_SEPARATOR);
      }

      if (done) break;
    }

    const lastEvent = parseEventBlock(buffered);
    if (lastEvent) yield lastEvent;
  } finally {
    reader.releaseLock();
  }
}

function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function parseEventBlock(block: string): ServerSentEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;

    const colonAt = line.indexOf(":");
    const field = colonAt === -1 ? line : line.slice(0, colonAt);
    const value = colonAt === -1 ? "" : line.slice(colonAt + 1).replace(/^ /, "");

    if (field === "event") event = value;
    if (field === "data") dataLines.push(value);
  }

  return dataLines.length > 0 ? { event, data: dataLines.join("\n") } : null;
}
