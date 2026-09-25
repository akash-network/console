import { queryObjects } from "node:v8";
import { describe, expect, it } from "vitest";

import type { WebSocketUsage } from "./WebsocketStats";
import { ClientWebSocketStats, WebsocketStats } from "./WebsocketStats";

const NO_USAGE = { count: 0, data: 0 };

describe(ClientWebSocketStats.name, () => {
  describe("setUsage", () => {
    it("increments the count for a known usage", () => {
      const { client, wsStats } = setup();

      client.setUsage("StreamLogs");

      expect(wsStats.getStats().usageStats.StreamLogs.count).toBe(1);
    });

    it("does not increment any count for the Unknown usage", () => {
      const { client, wsStats } = setup();

      client.setUsage("Unknown");

      expect(wsStats.getStats().totalStats.count).toBe(0);
    });
  });

  describe("logDataTransfer", () => {
    it("accumulates transferred data under the current usage", () => {
      const { client, wsStats } = setup();
      client.setUsage("Shell");

      client.logDataTransfer(100);
      client.logDataTransfer(50);

      expect(wsStats.getStats().usageStats.Shell.data).toBe(150);
    });

    it("keeps accumulating data logged after the connection closed", () => {
      const { client, wsStats } = setup();
      client.setUsage("DownloadLogs");
      client.close();

      client.logDataTransfer(30);

      expect(wsStats.getStats().usageStats.DownloadLogs).toEqual({ count: 1, data: 30 });
    });
  });

  describe("close", () => {
    it("stops counting the connection as open", () => {
      const { client, wsStats } = setup();

      client.close();

      expect(wsStats.getStats().openClientWebSocketCount).toBe(0);
    });

    it("stops counting the connection as open only once when closed twice", () => {
      const { client, wsStats } = setup();
      wsStats.create();

      client.close();
      client.close();

      expect(wsStats.getStats().openClientWebSocketCount).toBe(1);
    });
  });

  describe("isClosed", () => {
    it("returns false before close is called", () => {
      const { client } = setup();

      expect(client.isClosed()).toBe(false);
    });

    it("returns true after close is called", () => {
      const { client } = setup();

      client.close();

      expect(client.isClosed()).toBe(true);
    });
  });

  function setup() {
    const wsStats = new WebsocketStats();
    const client = wsStats.create();
    return { wsStats, client };
  }
});

describe(WebsocketStats.name, () => {
  it("reports no open connection and no usage before any connection is created", () => {
    const { wsStats } = setup();

    expect(wsStats.getStats()).toEqual({
      openClientWebSocketCount: 0,
      usageStats: { StreamLogs: NO_USAGE, StreamEvents: NO_USAGE, Shell: NO_USAGE, DownloadLogs: NO_USAGE, Unknown: NO_USAGE },
      totalStats: NO_USAGE
    });
  });

  it("gives each created connection its own id", () => {
    const { wsStats } = setup();

    const first = wsStats.create();
    const second = wsStats.create();

    expect(second.id).not.toBe(first.id);
  });

  it("follows a connection from open through usage and data to closed", () => {
    const { wsStats } = setup();

    const client = wsStats.create();
    expect(wsStats.getStats().openClientWebSocketCount).toBe(1);

    client.setUsage("StreamLogs");
    client.logDataTransfer(100);
    expect(wsStats.getStats().usageStats.StreamLogs).toEqual({ count: 1, data: 100 });

    client.close();
    expect(wsStats.getStats()).toEqual({
      openClientWebSocketCount: 0,
      usageStats: { StreamLogs: { count: 1, data: 100 }, StreamEvents: NO_USAGE, Shell: NO_USAGE, DownloadLogs: NO_USAGE, Unknown: NO_USAGE },
      totalStats: { count: 1, data: 100 }
    });
  });

  it("aggregates concurrent connections of different usages", () => {
    const { wsStats } = setup();
    const logs = wsStats.create();
    const shell = wsStats.create();
    const events = wsStats.create();

    logs.setUsage("StreamLogs");
    shell.setUsage("Shell");
    logs.logDataTransfer(300);
    events.setUsage("StreamEvents");
    shell.logDataTransfer(50);
    events.logDataTransfer(200);
    shell.setUsage("Shell");
    shell.logDataTransfer(25);
    logs.close();

    expect(wsStats.getStats()).toEqual({
      openClientWebSocketCount: 2,
      usageStats: {
        StreamLogs: { count: 1, data: 300 },
        StreamEvents: { count: 1, data: 200 },
        Shell: { count: 2, data: 75 },
        DownloadLogs: NO_USAGE,
        Unknown: NO_USAGE
      },
      totalStats: { count: 4, data: 575 }
    });
  });

  it("sums data logged before any usage is set into the totals without counting it as a request", () => {
    const { wsStats } = setup();
    const client = wsStats.create();

    client.logDataTransfer(40);
    client.setUsage("DownloadLogs");
    client.logDataTransfer(60);

    expect(wsStats.getStats()).toEqual({
      openClientWebSocketCount: 1,
      usageStats: { StreamLogs: NO_USAGE, StreamEvents: NO_USAGE, Shell: NO_USAGE, DownloadLogs: { count: 1, data: 60 }, Unknown: { count: 0, data: 40 } },
      totalStats: { count: 1, data: 100 }
    });
  });

  it("releases closed connections while their totals persist", () => {
    const { wsStats } = setup();
    const liveConnectionsBefore = queryObjects(ClientWebSocketStats, { format: "count" });

    openUseAndClose(wsStats, { usage: "Shell", dataTransferred: 100 });
    openUseAndClose(wsStats, { usage: "Shell", dataTransferred: 50 });

    expect(queryObjects(ClientWebSocketStats, { format: "count" })).toBe(liveConnectionsBefore);
    expect(wsStats.getStats().usageStats.Shell).toEqual({ count: 2, data: 150 });
  });

  function openUseAndClose(wsStats: WebsocketStats, input: { usage: WebSocketUsage; dataTransferred: number }) {
    const client = wsStats.create();
    client.setUsage(input.usage);
    client.logDataTransfer(input.dataTransferred);
    client.close();
  }

  function setup() {
    const wsStats = new WebsocketStats();
    return { wsStats };
  }
});
