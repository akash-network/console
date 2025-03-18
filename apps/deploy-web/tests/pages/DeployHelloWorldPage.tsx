import { DeployBasePage, type FeeType } from "./DeployBasePage";

export class DeployHelloWorldPage extends DeployBasePage {
  protected readonly feeType: FeeType = "medium";

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
