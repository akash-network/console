import { NodeHttpService } from "@akashnetwork/http-sdk";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { GetNodesParams, GetNodesResponse } from "../../http-schemas/network.schema";

@singleton()
export class NetworkService {
  constructor(private readonly nodeHttpService: NodeHttpService) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getNodes(network: GetNodesParams["network"]): Promise<GetNodesResponse> {
    return await this.nodeHttpService.getNodes(network);
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getVersion(network: GetNodesParams["network"]): Promise<string> {
    return await this.nodeHttpService.getVersion(network);
  }
}
