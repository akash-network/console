import { createRoute, z } from "@hono/zod-openapi";
import type { TypedResponse } from "hono";

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
  const { openClientWebSocketCount, usageStats, totalStats } = ctx.get("container").wsStats.getStats();
  const { StreamLogs: logStreaming, DownloadLogs: logDownload, StreamEvents: eventStreaming, Shell: shell } = usageStats;

  return ctx.json({
    openClientWebSocketCount,
    totalRequestCount: totalStats.count,
    totalTransferred: humanFileSize(totalStats.data),
    logStreaming: `${logStreaming.count} (${humanFileSize(logStreaming.data)})`,
    logDownload: `${logDownload.count} (${humanFileSize(logDownload.data)})`,
    eventStreaming: `${eventStreaming.count} (${humanFileSize(eventStreaming.data)})`,
    shell: `${shell.count} (${humanFileSize(shell.data)})`,
    version: process.env.APP_VERSION || "0.0.0-local"
  });
}
