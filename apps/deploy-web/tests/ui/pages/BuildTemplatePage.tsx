import { testEnvConfig } from "../fixture/test-env.config";
import { DeployBasePage } from "./DeployBasePage";
export class BuildTemplatePage extends DeployBasePage {
  async gotoInteractive() {
    await this.page.goto(testEnvConfig.BASE_URL);
    await this.page.getByTestId("sidebar-sdl-builder-link").first().click();
  }
}
