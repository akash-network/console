import { GitHubHttpService } from "@akashnetwork/http-sdk";
import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { loadLocalProviderAttributesSchema } from "../seeders/provider-attributes-schema.seeder";

export function registerLocalProviderAttributesSchemaGitHubHttpService() {
  container.register(GitHubHttpService, {
    useValue: mock<GitHubHttpService>({
      getProviderAttributesSchema: async () => loadLocalProviderAttributesSchema()
    })
  });
}
