import { DeployBasePage } from "./DeployBasePage";

export class BuildTemplatePage extends DeployBasePage {
  async gotoInteractive() {
    await this.page.goto("http://localhost:3000");
    await this.page.getByTestId("sidebar-sdl-builder-link").first().click();
  }
}
