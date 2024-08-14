import { DeployBasePage } from "./DeployBasePage";

export class DeployHelloWorldPage extends DeployBasePage {
  async fillImageName(name: string) {
    await this.page.getByTestId("image-name-input").fill(name);
  }
}
