import { randomUUID } from "node:crypto";

export class WebsocketStats {
  private readonly aggregates: WebsocketAggregates = {
    openClientWebSocketCount: 0,
    usageStats: {
      StreamLogs: { count: 0, data: 0 },
      StreamEvents: { count: 0, data: 0 },
      Shell: { count: 0, data: 0 },
      DownloadLogs: { count: 0, data: 0 },
      Unknown: { count: 0, data: 0 }
    }
  };

  create(): ClientWebSocketStats {
    this.aggregates.openClientWebSocketCount += 1;
    return new ClientWebSocketStats(randomUUID(), this.aggregates);
  }

  getStats(): {
    openClientWebSocketCount: number;
    usageStats: Readonly<Record<WebSocketUsage, Readonly<UsageStats>>>;
    totalStats: UsageStats;
  } {
    const { openClientWebSocketCount, usageStats } = this.aggregates;

    return {
      openClientWebSocketCount,
      usageStats,
      totalStats: (Object.keys(usageStats) as WebSocketUsage[]).reduce(
        (s, n) => {
          return {
            count: s.count + usageStats[n].count,
            data: s.data + usageStats[n].data
          };
        },
        { count: 0, data: 0 }
      )
    };
  }
}

export class ClientWebSocketStats {
  readonly id: string;
  private usage: WebSocketUsage = "Unknown";
  private closed = false;

  constructor(
    id: string,
    private readonly aggregates: WebsocketAggregates
  ) {
    this.id = id;
  }

  setUsage(usage: WebSocketUsage): void {
    this.usage = usage;

    if (usage !== "Unknown") {
      this.aggregates.usageStats[usage].count += 1;
    }
  }

  logDataTransfer(dataTransferred: number): void {
    this.aggregates.usageStats[this.usage].data += dataTransferred;
  }

  close(): void {
    if (this.closed) return;

    this.closed = true;
    this.aggregates.openClientWebSocketCount -= 1;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

interface WebsocketAggregates {
  openClientWebSocketCount: number;
  usageStats: Record<WebSocketUsage, UsageStats>;
}

type UsageStats = { count: number; data: number };

export type WebSocketUsage = "StreamLogs" | "StreamEvents" | "Shell" | "DownloadLogs" | "Unknown";
