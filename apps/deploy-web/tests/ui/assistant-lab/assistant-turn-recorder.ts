import type { BrowserContext, Page } from "@playwright/test";

export interface RecordedEvent {
  at: number;
  event: { type: string; [key: string]: unknown };
}

export interface RecordedRequest {
  url: string;
  startedAt: number;
  endedAt: number | null;
  status: number | null;
  events: RecordedEvent[];
}

const TURN_URL_PATTERN = "/v1/assistant/conversations/[^/]+/(messages|client-tool-results)$";

export async function recordAssistantStreams(context: BrowserContext): Promise<void> {
  await context.addInitScript(urlPattern => {
    const turnUrl = new RegExp(urlPattern);
    const lab = { requests: [] as RecordedRequest[] };
    (window as unknown as { __assistantLab: typeof lab }).__assistantLab = lab;
    const originalFetch = window.fetch.bind(window);

    async function readEvents(stream: ReadableStream<Uint8Array>, record: RecordedRequest) {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = block
            .split("\n")
            .filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trimStart())
            .join("\n");
          if (data) {
            try {
              record.events.push({ at: Date.now(), event: JSON.parse(data) });
            } catch {
              record.events.push({ at: Date.now(), event: { type: "unparsable", data } });
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!turnUrl.test(url)) return originalFetch(input, init);

      const record: RecordedRequest = { url, startedAt: Date.now(), endedAt: null, status: null, events: [] };
      lab.requests.push(record);
      const response = await originalFetch(input, init);
      record.status = response.status;
      if (!response.body) {
        record.endedAt = Date.now();
        return response;
      }

      const [mine, theirs] = response.body.tee();
      readEvents(mine, record)
        .catch(() => undefined)
        .finally(() => {
          record.endedAt = Date.now();
        });

      return new Response(theirs, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
  }, TURN_URL_PATTERN);
}

export async function recordedRequests(page: Page): Promise<RecordedRequest[]> {
  return page.evaluate(() => (window as unknown as { __assistantLab?: { requests: RecordedRequest[] } }).__assistantLab?.requests ?? []);
}

function endsTheTurn(request: RecordedRequest): boolean {
  const last = request.events.at(-1)?.event;
  if (request.endedAt === null) return false;
  if (request.status !== 200) return true;
  if (!last) return true;

  return last.type === "error" || (last.type === "done" && last.reason !== "awaiting_client_tool");
}

export async function waitForTurnEnd(page: Page, sentAt: number, timeoutMs: number): Promise<{ requests: RecordedRequest[]; timedOut: boolean }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const requests = (await recordedRequests(page)).filter(request => request.startedAt >= sentAt - 50);
    const last = requests.at(-1);
    if (last && endsTheTurn(last)) return { requests, timedOut: false };
    if (!last && Date.now() - sentAt > 15_000) return { requests, timedOut: false };
    await page.waitForTimeout(400);
  }

  return { requests: (await recordedRequests(page)).filter(request => request.startedAt >= sentAt - 50), timedOut: true };
}
