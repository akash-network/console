import { GitHubHttpService } from "@akashnetwork/http-sdk";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";

@singleton()
export class AuditorService {
  constructor(private readonly gitHubHttpService: GitHubHttpService) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getAuditors() {
    return await this.gitHubHttpService.getAuditors();
  }
}
