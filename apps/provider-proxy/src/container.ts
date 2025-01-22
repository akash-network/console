import { ProviderProxy } from "./services/ProviderProxy";
import { WebsocketStats } from "./services/WebsocketStats";

export const container = {
  wsStats: new WebsocketStats(),
  providerProxy: new ProviderProxy()
};
