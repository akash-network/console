import type { SupportedChainNetworks } from "@akashnetwork/net";
import z from "zod";

import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { NetworkNode } from "./types";

const metaSchema = z.object({
  codebase: z.object({
    recommended_version: z.string()
  })
});

type Meta = z.infer<typeof metaSchema>;

export class NodeHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getNodes(network: SupportedChainNetworks): Promise<NetworkNode[]> {
    return extractData(await this.httpClient.get<NetworkNode[]>(`console/main/config/${network}-nodes.json`));
  }

  async getVersion(network: SupportedChainNetworks): Promise<string> {
    return extractData(await this.httpClient.get<string>(`net/master/${network}/version.txt`));
  }

  async getMeta(network: SupportedChainNetworks): Promise<Meta> {
    const response = extractData(await this.httpClient.get<unknown>(`net/master/${network}/meta.json`));
    return metaSchema.parse(response);
  }
}
