import type { LoggerService } from "@akashnetwork/logging";
import { EventEmitter } from "events";
import { Hono } from "hono";
import { mock } from "jest-mock-extended";

import { startServer } from "./start-server";

describe(startServer.name, () => {
  it("starts and returns a server", async () => {
    const app = new Hono();
    const logger = mock<LoggerService>();
    const emitter = new EventEmitter();

    const server = await startServer(app, logger, emitter, { port: 0 });
    expect(server).toBeDefined();

    await new Promise<void>(resolve => server?.close(() => resolve()));
  });
});
