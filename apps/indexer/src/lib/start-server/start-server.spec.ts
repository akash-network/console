import type { ServerType } from "@hono/node-server";
import EventEmitter from "events";
import type { Hono } from "hono";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServerLogger } from "../server-logger/server-logger";
import type { AppInitializer } from "./app-initializer";
import { ON_APP_START, ON_APP_STOP } from "./app-initializer";
import { startServer } from "./start-server";

describe("startServer", () => {
  afterEach(() => {
    startedServer?.close();
  });

  it("starts server with all initialization steps", async () => {
    const { start, logger } = setup();

    const server = await start();

    expect(server?.listening).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SERVER_STARTING",
        url: expect.stringMatching(/^http:\/\/localhost:\d+$/)
      })
    );
  });

  it("call beforeStart callback before running initializers", async () => {
    const beforeStart = vi.fn().mockResolvedValue(undefined);
    const initializers: AppInitializer[] = [{ [ON_APP_START]: vi.fn().mockResolvedValue(undefined) }];
    const { start } = setup({ beforeStart, initializers });

    await start();

    expect(beforeStart.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(initializers[0][ON_APP_START]).mock.invocationCallOrder[0]);
  });

  it("calls ON_APP_START methods of all initializers", async () => {
    const initializers: AppInitializer[] = [{ [ON_APP_START]: vi.fn().mockResolvedValue(undefined) }, { [ON_APP_START]: vi.fn().mockResolvedValue(undefined) }];
    const { start } = setup({ initializers });

    await start();

    expect(initializers[0][ON_APP_START]).toHaveBeenCalled();
    expect(initializers[1][ON_APP_START]).toHaveBeenCalled();
  });

  it("registers shutdown handlers for process events", async () => {
    const { start, processEvents } = setup({});

    vi.spyOn(processEvents, "on");
    await start();

    expect(processEvents.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processEvents.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(processEvents.on).toHaveBeenCalledWith("exit", expect.any(Function));
  });

  it("stops app when server is closed", async () => {
    const { start, onStop } = setup();

    const { server } = await start()
      .then(server => ({ server }))
      .catch(error => ({ error, server: undefined }));
    server?.close();
    await delay(10);

    expect(onStop).toHaveBeenCalled();
  });

  it("calls ON_APP_STOP methods of all initializers after onStop", async () => {
    const initializers: AppInitializer[] = [{ [ON_APP_START]: vi.fn(), [ON_APP_STOP]: vi.fn().mockResolvedValue(undefined) }];
    const { start, onStop } = setup({ initializers });

    const server = await start();
    server?.close();
    await delay(10);

    expect(initializers[0][ON_APP_STOP]).toHaveBeenCalled();
    expect(onStop.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(initializers[0][ON_APP_STOP]!).mock.invocationCallOrder[0]);
  });

  it("calls ON_APP_STOP methods of all initializers when onStop fails", async () => {
    const initializers: AppInitializer[] = [{ [ON_APP_START]: vi.fn(), [ON_APP_STOP]: vi.fn().mockResolvedValue(undefined) }];
    const error = new Error("Failed to stop app");
    const { start, logger } = setup({ initializers, onStop: vi.fn().mockRejectedValue(error) });

    const server = await start();
    server?.close();
    await delay(10);

    expect(initializers[0][ON_APP_STOP]).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({ event: "APP_STOP_ERROR", error });
  });

  it("logs error when an initializer ON_APP_STOP fails", async () => {
    const error = new Error("Failed to stop initializer");
    const initializers: AppInitializer[] = [{ [ON_APP_START]: vi.fn(), [ON_APP_STOP]: vi.fn().mockRejectedValue(error) }];
    const { start, logger } = setup({ initializers });

    const server = await start();
    server?.close();
    await delay(10);

    expect(logger.error).toHaveBeenCalledWith({ event: "APP_INITIALIZER_STOP_ERROR", error });
  });

  it("stops app when process receives SIGTERM signal", async () => {
    const { start, onStop, processEvents } = setup();

    const server = await start();
    const closeServer = vi.spyOn(server!, "close");
    processEvents.emit("SIGTERM");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();
  });

  it("stops app when process receives SIGINT signal", async () => {
    const { start, onStop, processEvents } = setup();

    const server = await start();
    const closeServer = vi.spyOn(server!, "close");
    processEvents.emit("SIGINT");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();
  });

  it("stops app when process receives exit signal", async () => {
    const { start, onStop, processEvents } = setup();

    const server = await start();
    const closeServer = vi.spyOn(server!, "close");
    processEvents.emit("exit");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();
  });

  it("stops app only once when process receives multiple signals", async () => {
    const { start, onStop, processEvents } = setup();

    const server = await start();
    const closeServer = vi.spyOn(server!, "close");
    processEvents.emit("exit");
    processEvents.emit("SIGINT");
    processEvents.emit("SIGTERM");
    await delay(10);

    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("logs error when app.fetch throws an error", async () => {
    const error = new Error("Unexpected error");
    const { start, app, logger } = setup();
    app.fetch.mockRejectedValue(error);

    const server = await start();
    const { port } = server!.address() as { port: number };

    await fetch(`http://localhost:${port}`).catch(() => {});
    await delay(10);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "OUTSIDE_OF_APP_ERROR",
        error
      })
    );
  });

  it("stops app when `beforeStart` throws an error", async () => {
    const { start, onStop } = setup({ beforeStart: vi.fn().mockRejectedValue(new Error("Failed to start server")) });

    await start().catch(() => {});
    await delay(10);

    expect(onStop).toHaveBeenCalled();
  });

  it("stops app when an initializer throws an error", async () => {
    const { start, onStop } = setup({ initializers: [{ [ON_APP_START]: vi.fn().mockRejectedValue(new Error("Failed to start server")) }] });

    await start().catch(() => {});
    await delay(10);

    expect(onStop).toHaveBeenCalled();
  });

  let startedServer: ServerType | undefined;
  function setup(input?: { beforeStart?: () => Promise<void>; port?: number; initializers?: AppInitializer[]; onStop?: () => Promise<void> }) {
    const app = mock<Hono<any>>();
    const logger = mock<ServerLogger>();
    const processEvents = new EventEmitter();
    const onStop = vi.fn(input?.onStop ?? (async () => undefined));

    const options = {
      port: input?.port ?? 0,
      beforeStart: input?.beforeStart,
      initializers: input?.initializers,
      onStop
    };

    const start = async () => {
      startedServer = await startServer(app, logger, processEvents, options);
      return startedServer;
    };

    return {
      app,
      logger,
      processEvents,
      start,
      onStop
    };
  }
});
