import type { FeeType } from "./DeployBasePage";
import { DeployBasePage } from "./DeployBasePage";

export class DeployHelloWorldPage extends DeployBasePage {
  protected readonly feeType: FeeType = "medium";

  async createDeploymentAndSign() {
    await Promise.all([this.createDeployment(), this.signTransaction()]);
  }

  async createLeaseAndSign() {
    await Promise.all([this.createLease(), this.signTransaction()]);
  }

  async validateLeaseAndClose() {
    await this.validateLease();
    await Promise.all([this.closeDeploymentDetail(), this.signTransaction()]);
  }
}
