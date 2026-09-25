import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Container } from "../container";
import { WebsocketStats } from "../services/WebsocketStats";
import type { AppEnv } from "../types/AppContext";
import { getAppStatus, statusRoute } from "./getAppStatus";

describe(getAppStatus.name, () => {
  it("reports open connections and the usage of every connection seen, open or closed", async () => {
    const { wsStats, requestStatus } = setup();
    const logStream = wsStats.create();
    logStream.setUsage("StreamLogs");
    logStream.logDataTransfer(1_536);
    logStream.close();
    const shell = wsStats.create();
    shell.logDataTransfer(512);
    shell.setUsage("Shell");
    shell.setUsage("Shell");
    shell.logDataTransfer(2_048);
    const events = wsStats.create();
    events.setUsage("StreamEvents");
    events.logDataTransfer(3_072);
    const download = wsStats.create();
    download.setUsage("DownloadLogs");
    download.logDataTransfer(5_120);
    download.close();

    const response = await requestStatus();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      openClientWebSocketCount: 2,
      totalRequestCount: 5,
      totalTransferred: "12.0 KiB",
      logStreaming: "1 (1.5 KiB)",
      logDownload: "1 (5.0 KiB)",
      eventStreaming: "1 (3.0 KiB)",
      shell: "2 (2.0 KiB)",
      version: "0.0.0-local"
    });
  });

  function setup() {
    const wsStats = new WebsocketStats();
    const app = new OpenAPIHono<AppEnv>();
    app.use((ctx, next) => {
      ctx.set("container", mock<Container>({ wsStats }));
      return next();
    });
    app.openapi(statusRoute, getAppStatus);

    return { wsStats, requestStatus: () => app.request("/status") };
  }
});
