import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { ShellExecRequest, ShellExecResponse } from "@src/deployment/http-schemas/shell-exec.schema";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { ShellExecService } from "@src/deployment/services/shell-exec/shell-exec.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";

@singleton()
export class ShellExecController {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly providerService: ProviderService,
    private readonly shellExecService: ShellExecService,
    private readonly authService: AuthService,
    private readonly walletReaderService: WalletReaderService
  ) {}

  @Protected([{ action: "read", subject: "Lease" }])
  async exec(input: ShellExecRequest & { dseq: string; gseq: number; oseq: number }): Promise<ShellExecResponse> {
    const userId = this.authService.currentUser.id;

    const deployment = await this.deploymentReaderService.findByUserIdAndDseq(userId, input.dseq);

    assert(deployment, 404, "Deployment not found");
    assert(deployment.deployment.state === "active", 400, "Deployment is not active");

    const lease = deployment.leases.find(l => l.id.gseq === input.gseq && l.id.oseq === input.oseq);

    assert(lease, 404, "Lease not found");
    assert(lease.id.provider, 500, "Lease provider address not found");
    assert(lease.state === "active", 400, "Lease is not active");

    const providerAddress = lease.id.provider;

    const wallet = await this.walletReaderService.getWalletByUserId(userId);

    const auth = await this.providerService.toProviderAuth({ walletId: wallet.id, provider: providerAddress }, ["shell"]);

    const providerInfo = await this.providerService.getProvider(providerAddress);

    assert(providerInfo, 404, "Provider not found");

    const result = await this.shellExecService.execute({
      providerBaseUrl: providerInfo.hostUri,
      providerAddress: providerAddress,
      dseq: input.dseq,
      gseq: input.gseq,
      oseq: input.oseq,
      service: input.service,
      command: input.command,
      timeout: input.timeout,
      jwtToken: auth.token
    });

    if (!result.ok) {
      const message = result.val.startsWith("Command timed out")
        ? "Command execution timed out"
        : result.val.startsWith("WebSocket connection failed")
          ? "Failed to connect to provider"
          : result.val.startsWith("Provider error")
            ? "Provider returned an error"
            : "Shell execution failed";
      assert(false, 502, message);
    }

    return result.val;
  }
}
