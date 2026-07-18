import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { ShellExecRequest, ShellExecResponse } from "@src/deployment/http-schemas/shell-exec.schema";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { ShellExecService } from "@src/deployment/services/shell-exec/shell-exec.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";

type ExecErrorMapping = { status: number; message: string };

/**
 * Ordered mapping from a service-layer error sentinel (the stable, prefixed
 * strings returned by `ShellExecService.execute`) to a user-facing HTTP status
 * and message. Keeping this a table — rather than a chain of ternaries — makes
 * the contract readable, testable, and cheap to extend, and guarantees the raw
 * internal string is never leaked to the client. Each failure mode gets the
 * semantically correct status:
 *   - timeout            → 504 (we are a gateway to the provider, not a slow client)
 *   - auth expired       → 403
 *   - invalid host       → 502 (`hostUri` is server-derived on-chain data, not
 *                                client input, so a bad host is an upstream fault)
 *   - connection/provider→ 502
 */
const EXEC_ERROR_TABLE: ReadonlyArray<{ prefix: string } & ExecErrorMapping> = [
  { prefix: "Command timed out", status: 504, message: "Command execution timed out" },
  { prefix: "Auth expired", status: 403, message: "Provider authentication expired" },
  { prefix: "Invalid provider host", status: 502, message: "Invalid provider host" },
  { prefix: "WebSocket connection failed", status: 502, message: "Failed to connect to provider" },
  { prefix: "Provider error", status: 502, message: "Provider returned an error" },
  { prefix: "Connection closed without exit code", status: 502, message: "Provider connection closed unexpectedly" }
];

export function mapExecError(errVal: string): ExecErrorMapping {
  const match = EXEC_ERROR_TABLE.find(entry => errVal.startsWith(entry.prefix));
  return match ? { status: match.status, message: match.message } : { status: 502, message: "Shell execution failed" };
}

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

    const providerInfo = await this.providerService.getProvider(providerAddress);

    assert(providerInfo, 404, "Provider not found");

    const wallet = await this.walletReaderService.getWalletByUserId(userId);

    const auth = await this.providerService.toProviderAuth({ walletId: wallet.id, provider: providerAddress }, ["shell"]);

    const result = await this.shellExecService.execute({
      providerBaseUrl: providerInfo.hostUri,
      providerAddress: providerAddress,
      dseq: input.dseq,
      gseq: input.gseq,
      oseq: input.oseq,
      service: input.service,
      command: input.command,
      stdin: input.stdin,
      timeout: input.timeout,
      jwtToken: auth.token
    });

    if (!result.ok) {
      const { status, message } = mapExecError(result.val);
      assert(false, status, message);
    }

    return result.val;
  }
}
