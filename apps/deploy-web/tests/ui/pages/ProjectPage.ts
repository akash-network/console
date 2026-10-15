import type { Page } from "@playwright/test";

/** One project's page: its deployments, with the project's own activity beside them. */
export class ProjectPage {
  constructor(readonly page: Page) {}

  /** The project switcher that titles the page, named after the project. */
  heading(projectName: string) {
    return this.page.getByRole("heading", { level: 1, name: projectName });
  }

  /** Both the header link and the empty list's link carry the project into the new deployment. */
  async startNewDeployment() {
    await this.page.getByRole("link", { name: "New deployment" }).first().click();
  }

  /** Matched by its selection checkbox, which only the deployment list renders, since the activity beside it links to the same name. */
  listedDeployment(deploymentName: string) {
    return this.page.getByRole("checkbox", { name: `Select deployment ${deploymentName}` });
  }
}
