import { HttpError } from "http-errors";
import { Result } from "ts-results";
import { singleton } from "tsyringe";

import { NetworkService } from "@src/network/services/network/network.service";
import type { GetNodesParams, GetNodesResponse } from "../../http-schemas/network.schema";

@singleton()
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  async getNodes(network: GetNodesParams["network"]): Promise<Result<GetNodesResponse, HttpError>> {
    return await this.networkService.getNodes(network);
  }
}
