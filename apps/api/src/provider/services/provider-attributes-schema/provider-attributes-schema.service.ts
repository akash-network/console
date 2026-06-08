import { GitHubHttpService } from "@akashnetwork/http-sdk";
import { minutesToSeconds } from "date-fns";
import fs from "fs/promises";
import path from "path";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";

@singleton()
export class ProviderAttributesSchemaService {
  constructor(private readonly gitHubHttpService: GitHubHttpService) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getProviderAttributesSchema() {
    if (process.env.DEPLOYMENT_ENV === "test") {
      const schemaPath = path.join(__dirname, "../../../../../../config/provider-attributes.json");
      return JSON.parse(await fs.readFile(schemaPath, "utf8"));
    }

    return await this.gitHubHttpService.getProviderAttributesSchema();
  }
}
