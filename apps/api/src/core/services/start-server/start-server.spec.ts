import type { LoggerService } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import EventEmitter from "events";
import type { Hono } from "hono";
import { mock } from "jest-mock-extended";
import { setTimeout as delay } from "timers/promises";
import type { DependencyContainer } from "tsyringe";

import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { startServer } from "./start-server";

describe("startServer", () => {
  afterEach(() => {
    startedServer?.close();
  });

  it("starts server with all initialization steps", async () => {
    const { start, container, logger } = setup();

    const server = await start();

    expect(server?.listening).toBe(true);
    expect(container.resolveAll).toHaveBeenCalledWith(APP_INITIALIZER);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SERVER_STARTING",
        url: expect.stringMatching(/^http:\/\/localhost:\d+$/)
      })
    );
  });

  it("call beforeStart callback before running APP_INITIALIZERs", async () => {
    const beforeStart = jest.fn().mockResolvedValue(undefined);
    const { start, container } = setup({ beforeStart });

    await start();

    expect(beforeStart.mock.invocationCallOrder[0]).toBeLessThan(container.resolveAll.mock.invocationCallOrder[0]);
  });

  it("resolves all APP_INITIALIZER services and call their ON_APP_START methods", async () => {
    const initializers: AppInitializer[] = [
      { [ON_APP_START]: jest.fn().mockResolvedValue(undefined) },
      { [ON_APP_START]: jest.fn().mockResolvedValue(undefined) }
    ];
    const { start, container } = setup({ initializers });

    await start();

    expect(container.resolveAll).toHaveBeenCalledWith(APP_INITIALIZER);
    expect(initializers[0][ON_APP_START]).toHaveBeenCalled();
    expect(initializers[1][ON_APP_START]).toHaveBeenCalled();
  });

  it("registers shutdown handlers for process events", async () => {
    const { start, processEvents } = setup({});

    jest.spyOn(processEvents, "on");
    await start();

    expect(processEvents.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processEvents.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(processEvents.on).toHaveBeenCalledWith("exit", expect.any(Function));
  });

  it("disposes container when server is closed", async () => {
    const { start, container } = setup();

    const server = await start();
    server?.close();
    await delay(10);

    expect(container.dispose).toHaveBeenCalled();
  });

  it("disposes container when process receives SIGTERM signal", async () => {
    const { start, container, processEvents } = setup();

    const server = await start();
    const closeServer = jest.spyOn(server!, "close");
    processEvents.emit("SIGTERM");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
  });

  it("disposes container when process receives SIGINT signal", async () => {
    const { start, container, processEvents } = setup();

    const server = await start();
    const closeServer = jest.spyOn(server!, "close");
    processEvents.emit("SIGINT");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
  });

  it("disposes container when process receives exit signal", async () => {
    const { start, container, processEvents } = setup();

    const server = await start();
    const closeServer = jest.spyOn(server!, "close");
    processEvents.emit("exit");
    await delay(10);

    expect(closeServer).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
  });

  it("disposes only once when process receives multiple signals", async () => {
    const { start, container, processEvents } = setup();

    const server = await start();
    const closeServer = jest.spyOn(server!, "close");
    processEvents.emit("exit");
    processEvents.emit("SIGINT");
    processEvents.emit("SIGTERM");
    await delay(10);

    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(container.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes container when `beforeStart` throws an error", async () => {
    const { start, container } = setup({ beforeStart: jest.fn().mockRejectedValue(new Error("Failed to start server")) });

    await start();
    await delay(10);

    expect(container.dispose).toHaveBeenCalled();
  });

  it("disposes container when `APP_INITIALIZER` throws an error", async () => {
    const { start, container } = setup({ initializers: [{ [ON_APP_START]: jest.fn().mockRejectedValue(new Error("Failed to start server")) }] });

    await start();
    await delay(10);

    expect(container.dispose).toHaveBeenCalled();
  });

  let startedServer: ServerType | undefined;
  function setup(input?: { beforeStart?: () => Promise<void>; port?: number; initializers?: Array<{ [ON_APP_START]: () => Promise<void> }> }) {
    const app = mock<Hono<any>>();
    const logger = mock<LoggerService>();
    const processEvents = new EventEmitter();
    const container = mock<DependencyContainer>({
      resolveAll: jest.fn().mockReturnValue(input?.initializers ?? [])
    });

    const options = {
      port: input?.port ?? 0,
      beforeStart: input?.beforeStart,
      container
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
      container
    };
  }
});
