import { DeployBasePage } from "./DeployBasePage";

export class DeployHelloWorldPage extends DeployBasePage {
  async createDeploymentAndSign() {
    await this.createDeployment();
    await this.signTransaction();
  }

  async createLeaseAndSign() {
    await this.createLease();
    await this.signTransaction();
  }

  async validateLeaseAndClose() {
    await this.validateLease();
    await this.closeDeploymentDetail();
    await this.signTransaction();
  }
}
