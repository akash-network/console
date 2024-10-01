import { DeployBasePage } from "./DeployBasePage";

export class DeployHelloWorldPage extends DeployBasePage {
  async createDeployment() {
    await this.gotoInteractive(true);
    await this.createDeployment();
    await this.signTransaction();
  }

  async createLease() {
    await this.createLease();
    await this.signTransaction();
  }

  async validateLeaseAndClose() {
    await this.validateLease();
    await this.closeDeploymentDetail();
    await this.signTransaction();
  }
}
