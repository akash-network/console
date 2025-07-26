import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import { mock } from "jest-mock-extended";

import { shutdownServer } from "./shutdown-server";

describe(shutdownServer.name, () => {
  it("closes the server ", async () => {
    const server = mock<ServerType>({
      close: jest.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it("logs error if server close fails", async () => {
    const error = new Error("Failed to close server");
    const server = mock<ServerType>({
      close: jest.fn().mockImplementation(cb => cb(error))
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(appLogger.error).toHaveBeenCalledWith({
      event: "SERVER_CLOSE_ERROR",
      error
    });
    expect(onShutdown).toHaveBeenCalled();
  });

  it("logs error if server close throws", async () => {
    const error = new Error("Failed to close server");
    const server = mock<ServerType>({
      close: jest.fn().mockImplementation(() => {
        throw error;
      }) as jest.Mock
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(appLogger.error).toHaveBeenCalledWith({
      event: "SERVER_CLOSE_ERROR",
      error
    });
    expect(onShutdown).toHaveBeenCalled();
  });

  it("logs error if onShutdown callback fails", async () => {
    const error = new Error("Failed to dispose container");
    const server = mock<ServerType>({
      close: jest.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn().mockRejectedValue(error);

    await shutdownServer(server, appLogger, onShutdown);

    expect(appLogger.error).toHaveBeenCalledWith({
      event: "CONTAINER_DISPOSE_ERROR",
      error
    });
  });

  it("calls shutdown directly if server is not listening", async () => {
    const server = mock<ServerType>({
      listening: false,
      close: jest.fn()
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).not.toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalled();
  });

  it("calls server.close if server is listening", async () => {
    const server = mock<ServerType>({
      listening: true,
      close: jest.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = jest.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalled();
  });
});
