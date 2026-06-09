import { GitHubHttpService } from "@akashnetwork/http-sdk";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";

@singleton()
export class ProviderAttributesSchemaService {
  constructor(private readonly gitHubHttpService: GitHubHttpService) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getProviderAttributesSchema() {
    return await this.gitHubHttpService.getProviderAttributesSchema();
  }
}
