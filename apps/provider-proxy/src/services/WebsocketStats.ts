import { v4 as uuidv4 } from "uuid";

export class WebsocketStats {
  private readonly items: ClientWebSocketStats[] = [];

  create(): ClientWebSocketStats {
    const item = new ClientWebSocketStats(uuidv4());
    this.items.push(item);
    return item;
  }

  getItems(): ReadonlyArray<ClientWebSocketStats> {
    return this.items;
  }
}

export class ClientWebSocketStats {
  readonly id: string;
  private openedOn: Date;
  private closedOn?: Date;
  private usage: WebSocketUsage = "Unknown";

  private usageStats: Record<WebSocketUsage, { count: number; data: number }> = {
    StreamLogs: { count: 0, data: 0 },
    StreamEvents: { count: 0, data: 0 },
    Shell: { count: 0, data: 0 },
    DownloadLogs: { count: 0, data: 0 },
    Unknown: { count: 0, data: 0 }
  };

  constructor(id: string) {
    this.id = id;
    this.openedOn = new Date();
  }

  setUsage(usage: WebSocketUsage) {
    this.usage = usage;

    if (usage !== "Unknown") {
      this.usageStats[usage].count += 1;
    }
  }

  logDataTransfer(dataTransferred: number) {
    this.usageStats[this.usage].data += dataTransferred;
  }

  close() {
    this.closedOn = new Date();
  }

  isClosed() {
    return !!this.closedOn;
  }

  getStats() {
    return {
      id: this.id,
      openedOn: this.openedOn,
      closedOn: this.closedOn,
      usageStats: this.usageStats,
      totalStats: (Object.keys(this.usageStats) as WebSocketUsage[]).reduce(
        (s, n) => {
          return {
            count: s.count + this.usageStats[n].count,
            data: s.data + this.usageStats[n].data
          };
        },
        { count: 0, data: 0 }
      )
    };
  }
}

export type WebSocketUsage = "StreamLogs" | "StreamEvents" | "Shell" | "DownloadLogs" | "Unknown";
