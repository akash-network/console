import type { SupportedChainNetworks } from "@akashnetwork/net";

import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { NetworkNode } from "./types";

export class NodeHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getNodes(network: SupportedChainNetworks): Promise<NetworkNode[]> {
    return extractData(await this.httpClient.get<NetworkNode[]>(`console/main/config/${network}-nodes.json`));
  }

  async getVersion(network: SupportedChainNetworks): Promise<string> {
    return extractData(await this.httpClient.get<string>(`net/master/${network}/version.txt`));
  }
}
