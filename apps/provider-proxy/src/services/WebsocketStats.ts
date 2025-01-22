import { ClientWebSocketStats } from "../ClientSocketStats";

export class WebsocketStats {
  private readonly items: ClientWebSocketStats[] = [];

  add(item: ClientWebSocketStats): void {
    this.items.push(item);
  }

  getItems(): ReadonlyArray<ClientWebSocketStats> {
    return this.items;
  }
}
