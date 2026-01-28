import type { Logger } from "@akashnetwork/logging";
import type { ServerType } from "@hono/node-server";
import { mock } from "jest-mock-extended";

import { shutdownServer } from "./shutdown-server";

describe(shutdownServer.name, () => {
  it("resolves when server is not listening", async () => {
    const server = mock<ServerType>({
      listening: false
    });
    const logger = mock<Logger>();

    await shutdownServer(server, logger);

    expect(server.close).not.toHaveBeenCalled();
  });
});
