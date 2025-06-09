import { singleton } from "tsyringe";

import { NetworkService } from "@src/network/services/network/network.service";
import type { GetNodesParams, GetNodesResponse } from "../../http-schemas/network.schema";

@singleton()
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  async getNodes(network: GetNodesParams["network"]): Promise<GetNodesResponse> {
    return await this.networkService.getNodes(network);
  }

  async getVersion(network: GetNodesParams["network"]): Promise<string> {
    return await this.networkService.getVersion(network);
  }
}
