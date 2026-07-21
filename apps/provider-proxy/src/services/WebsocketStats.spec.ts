import { describe, expect, it } from "vitest";

import { ClientWebSocketStats, WebsocketStats } from "./WebsocketStats";

describe(ClientWebSocketStats.name, () => {
  describe("setUsage", () => {
    it("increments the count for a known usage", () => {
      const { client } = setup();

      client.setUsage("StreamLogs");

      expect(client.getStats().usageStats.StreamLogs.count).toBe(1);
    });

    it("does not increment any count for the Unknown usage", () => {
      const { client } = setup();

      client.setUsage("Unknown");

      expect(client.getStats().totalStats.count).toBe(0);
    });
  });

  describe("logDataTransfer", () => {
    it("accumulates transferred data under the current usage", () => {
      const { client } = setup();
      client.setUsage("Shell");

      client.logDataTransfer(100);
      client.logDataTransfer(50);

      expect(client.getStats().usageStats.Shell.data).toBe(150);
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

  describe("getStats", () => {
    it("aggregates counts and data across usages into totalStats", () => {
      const { client } = setup();
      client.setUsage("StreamLogs");
      client.logDataTransfer(200);
      client.setUsage("DownloadLogs");
      client.logDataTransfer(300);

      const stats = client.getStats();

      expect(stats.totalStats).toEqual({ count: 2, data: 500 });
    });

    it("exposes the id and open timestamp with an undefined close timestamp while open", () => {
      const { client } = setup({ id: "socket-1" });

      const stats = client.getStats();

      expect(stats.id).toBe("socket-1");
      expect(stats.openedOn).toBeInstanceOf(Date);
      expect(stats.closedOn).toBeUndefined();
    });

    it("exposes the close timestamp once closed", () => {
      const { client } = setup();

      client.close();

      expect(client.getStats().closedOn).toBeInstanceOf(Date);
    });
  });

  function setup(input: { id?: string } = {}) {
    const client = new ClientWebSocketStats(input.id ?? "socket");
    return { client };
  }
});

describe(WebsocketStats.name, () => {
  it("tracks each created client in getItems", () => {
    const { stats } = setup();

    const first = stats.create();
    const second = stats.create();

    expect(stats.getItems()).toEqual([first, second]);
  });

  function setup() {
    const stats = new WebsocketStats();
    return { stats };
  }
});
