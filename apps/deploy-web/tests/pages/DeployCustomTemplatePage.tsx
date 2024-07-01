import { DeployBasePage } from "./DeployBasePage";

export class DeployCustomTemplatePage extends DeployBasePage {
  async fillImageName(name: string) {
    await this.page.getByTestId("image-name-input").fill(name);
  }

  async toggleSsh() {
    await this.page.getByTestId("ssh-toggle").check();
  }
}
