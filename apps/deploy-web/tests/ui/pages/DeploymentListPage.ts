import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class DeploymentListPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/deployments`);
  }

  /** Matched by its selection checkbox, named after the deployment, or after its dseq once the console holds no name for it. */
  listedDeployment(deploymentName: string) {
    return this.page.getByRole("checkbox", { name: `Select deployment ${deploymentName}` });
  }
}
