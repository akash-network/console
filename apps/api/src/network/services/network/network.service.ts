import { NodeHttpService } from "@akashnetwork/http-sdk";
import { NetConfig } from "@akashnetwork/net";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { GetNodesParams, GetNodesResponse } from "../../http-schemas/network.schema";

@singleton()
export class NetworkService {
  constructor(
    private readonly nodeHttpService: NodeHttpService,
    private readonly netConfig: NetConfig
  ) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getNodes(network: GetNodesParams["network"]): Promise<GetNodesResponse> {
    return await this.nodeHttpService.getNodes(this.netConfig.mapped(network));
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getVersion(network: GetNodesParams["network"]): Promise<string> {
    return await this.nodeHttpService.getVersion(this.netConfig.mapped(network));
  }
}
