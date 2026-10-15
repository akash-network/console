import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { escapeRegExp } from "./OrganizationSwitcher";

export class ProjectsPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/projects`);
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Projects" });
  }

  /** Takes a name that is already a slug, so the project is created under exactly that name. */
  async createProject(name: string) {
    await this.page.getByRole("button", { name: "New project" }).first().click();
    const dialog = this.page.getByRole("dialog", { name: "New project" });
    await dialog.getByLabel("Project name").fill(name);
    await dialog.getByRole("button", { name: "Create project" }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  projectFolder(name: string) {
    return this.page.getByRole("region", { name: "All projects" }).getByRole("link", { name: new RegExp(`^Open ${escapeRegExp(name)}(,|$)`) });
  }

  /** Waits for the project's own page, since this page's header has a "New deployment" link of its own that names no project. */
  async openProject(name: string) {
    await this.projectFolder(name).click();
    await this.page.waitForURL(url => /^\/projects\/[^/]+$/.test(url.pathname));
  }

  /** The organization's feed entry that links to the named deployment. */
  deploymentActivity(deploymentName: string) {
    return this.page
      .getByRole("region", { name: "Recent activity" })
      .getByRole("listitem")
      .filter({ has: this.page.getByRole("link", { name: deploymentName, exact: true }) });
  }
}
