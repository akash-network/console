import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import type { Mock } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { shutdownServer } from "./shutdown-server";

describe(shutdownServer.name, () => {
  it("closes the server ", async () => {
    const server = mock<ServerType>({
      close: vi.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(appLogger.error).not.toHaveBeenCalled();
  });

  it("logs error if server close fails", async () => {
    const error = new Error("Failed to close server");
    const server = mock<ServerType>({
      close: vi.fn().mockImplementation(cb => cb(error))
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn();

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
      close: vi.fn().mockImplementation(() => {
        throw error;
      }) as Mock
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn();

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
      close: vi.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn().mockRejectedValue(error);

    await shutdownServer(server, appLogger, onShutdown);

    expect(appLogger.error).toHaveBeenCalledWith({
      event: "ON_SHUTDOWN_ERROR",
      error
    });
  });

  it("calls shutdown directly if server is not listening", async () => {
    const server = mock<ServerType>({
      listening: false,
      close: vi.fn()
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).not.toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalled();
  });

  it("calls server.close if server is listening", async () => {
    const server = mock<ServerType>({
      listening: true,
      close: vi.fn().mockImplementation(cb => cb())
    });
    const appLogger = mock<Logger>();
    const onShutdown = vi.fn();

    await shutdownServer(server, appLogger, onShutdown);

    expect(server.close).toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalled();
  });
});
