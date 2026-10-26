import { makeNodeTransport } from "@sentry/nextjs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { createTimeoutHttpModule } from "./createTimeoutHttpModule";

type Envelope = Parameters<ReturnType<typeof makeNodeTransport>["send"]>[0];

const CLIENT_REPORT: Envelope = [{}, [[{ type: "client_report" }, { timestamp: 0, discarded_events: [] }]]];

describe(createTimeoutHttpModule.name, () => {
  it("fails an upload the ingest never answers once the timeout elapses", async () => {
    const { transport } = await setup({ answers: false, timeoutMs: 50 });

    await expect(transport.send(CLIENT_REPORT)).rejects.toThrow("Sentry upload timed out after 50 ms");
  });

  it("frees the transport buffer once a hung upload times out", async () => {
    const { transport } = await setup({ answers: false, timeoutMs: 50 });

    await expect(transport.send(CLIENT_REPORT)).rejects.toThrow();

    await expect(transport.flush(1_000)).resolves.toBe(true);
  });

  it("delivers an upload to a plain http ingest through the agent Sentry provides", async () => {
    const { transport } = await setup({ answers: true, timeoutMs: 1_000 });

    await expect(transport.send(CLIENT_REPORT)).resolves.toMatchObject({ statusCode: 200 });
  });

  async function setup(input: { answers: boolean; timeoutMs: number }) {
    const ingest = http.createServer((request, response) => {
      request.resume();
      if (input.answers) request.on("end", () => response.end("{}"));
    });
    await new Promise<void>(resolve => ingest.listen(0, "127.0.0.1", resolve));
    onTestFinished(() => {
      ingest.closeAllConnections();
      ingest.close();
    });
    const { port } = ingest.address() as AddressInfo;
    const transport = makeNodeTransport({
      url: `http://127.0.0.1:${port}/api/1/envelope/`,
      recordDroppedEvent: vi.fn(),
      httpModule: createTimeoutHttpModule(input.timeoutMs)
    });

    return { transport };
  }
});
