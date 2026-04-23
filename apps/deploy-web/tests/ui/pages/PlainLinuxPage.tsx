import type { SSH_VM_IMAGES } from "@src/utils/sdl/data";
import { DeployPage } from "./DeployPage";

export class PlainLinuxPage extends DeployPage {
  async selectDistro(distro: keyof typeof SSH_VM_IMAGES) {
    await this.page.getByRole("combobox", { name: /os image/i }).click();
    await this.page.getByRole("option", { name: distro }).click();
  }
}
