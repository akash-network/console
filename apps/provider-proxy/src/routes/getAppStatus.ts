import { Request, Response } from "express";

import packageJson from "../../package.json";
import { container } from "../container";
import { humanFileSize } from "../sizeUtils";

export async function getAppStatus(_: Request, res: Response): Promise<void> {
  const webSocketStats = container.wsStats.getItems();
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

  res.send({
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
