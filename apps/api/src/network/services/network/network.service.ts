import { NodeHttpService } from "@akashnetwork/http-sdk";
import { NetConfig } from "@akashnetwork/net";
import { AxiosError } from "axios";
import { minutesToSeconds } from "date-fns";
import { HttpError, NotFound } from "http-errors";
import { Err, Ok, Result } from "ts-results";
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
  async getNodes(network: GetNodesParams["network"]): Promise<Result<GetNodesResponse, HttpError>> {
    try {
      return Ok(await this.nodeHttpService.getNodes(this.netConfig.mapped(network)));
    } catch (error) {
      if (error instanceof AxiosError && error.status === 404) {
        return Err(new NotFound("Network nodes not found"));
      }

      throw error;
    }
  }
}
