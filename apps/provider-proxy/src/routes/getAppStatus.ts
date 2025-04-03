import { createRoute, z } from "@hono/zod-openapi";
import type { TypedResponse } from "hono";

import packageJson from "../../package.json";
import type { AppContext } from "../types/AppContext";
import { humanFileSize } from "../utils/sizeUtils";

const AppStatus = z.object({
  openClientWebSocketCount: z.number(),
  totalRequestCount: z.number(),
  totalTransferred: z.string(),
  logStreaming: z.string(),
  logDownload: z.string(),
  eventStreaming: z.string(),
  shell: z.string(),
  version: z.string()
});

export const statusRoute = createRoute({
  method: "get",
  path: "/status",
  responses: {
    200: {
      content: {
        "application/json": { schema: AppStatus }
      },
      description: "Retrieve app status"
    }
  }
});

export async function getAppStatus(ctx: AppContext): Promise<TypedResponse<z.infer<typeof AppStatus>, 200>> {
  const webSocketStats = ctx.get("container").wsStats.getItems();
  const openClientWebSocketCount = webSocketStats.filter(x => !x.isClosed()).length;
  const totalRequestCount = webSocketStats.reduce((a, b) => a + b.getStats().totalStats.count, 0);
  const totalTransferred = webSocketStats.reduce((a, b) => a + b.getStats().totalStats.data, 0);

  const logStreaming = webSocketStats
    .map(s => s.getStats().usageStats["StreamLogs"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const logDownload = webSocketStats
    .map(s => s.getStats().usageStats["DownloadLogs"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const eventStreaming = webSocketStats
    .map(s => s.getStats().usageStats["StreamEvents"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });
  const shell = webSocketStats
    .map(s => s.getStats().usageStats["Shell"])
    .reduce((a, b) => ({ count: a.count + b.count, data: a.data + b.data }), {
      count: 0,
      data: 0
    });

  return ctx.json({
    openClientWebSocketCount,
    totalRequestCount,
    totalTransferred: humanFileSize(totalTransferred),
    logStreaming: `${logStreaming.count} (${humanFileSize(logStreaming.data)})`,
    logDownload: `${logDownload.count} (${humanFileSize(logDownload.data)})`,
    eventStreaming: `${eventStreaming.count} (${humanFileSize(eventStreaming.data)})`,
    shell: `${shell.count} (${humanFileSize(shell.data)})`,
    version: packageJson.version
  });
}
