import type { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { DeployBasePage } from "./DeployBasePage";

export class PlainLinuxPage extends DeployBasePage {
  async selectDistro(distro: keyof typeof SSH_VM_IMAGES) {
    await this.page.getByTestId("ssh-image-select").click();
    await this.page.getByTestId(`ssh-image-select-${distro}`).click();
  }
}
