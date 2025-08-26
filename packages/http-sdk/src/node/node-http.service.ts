import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { NetworkNode } from "./types";

export class NodeHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getNodes(network: "mainnet" | "testnet" | "sandbox"): Promise<NetworkNode[]> {
    return extractData(await this.httpClient.get<NetworkNode[]>(`console/main/config/${network}-nodes.json`));
  }

  async getVersion(network: "mainnet" | "testnet" | "sandbox"): Promise<string> {
    const networkPath = network === "testnet" ? "testnet-02" : network;
    return extractData(await this.httpClient.get<string>(`net/master/${networkPath}/version.txt`));
  }
}
