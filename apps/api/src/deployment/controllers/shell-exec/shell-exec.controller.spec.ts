import { Err, Ok } from "ts-results";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { ShellExecService } from "@src/deployment/services/shell-exec/shell-exec.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { ShellExecController } from "./shell-exec.controller";

import { createUser } from "@test/seeders/user.seeder";

type DeploymentResponse = NonNullable<Awaited<ReturnType<DeploymentReaderService["findByUserIdAndDseq"]>>>;
type Lease = DeploymentResponse["leases"][number];
type ProviderInfo = NonNullable<Awaited<ReturnType<ProviderService["getProvider"]>>>;

function createLease(overrides: Partial<{ gseq: number; oseq: number; provider: string; state: string }> = {}): Lease {
  return mock<Lease>({
    id: { owner: "akash1owner", dseq: "1234", gseq: overrides.gseq ?? 1, oseq: overrides.oseq ?? 1, provider: overrides.provider ?? "akash1provider", bseq: 0 },
    state: overrides.state ?? "active",
    price: { denom: "uakt", amount: "100" },
    created_at: "12345",
    closed_on: "0",
    status: null
  });
}

function createDeployment(overrides: Partial<{ state: string; leases: Lease[] }> = {}): DeploymentResponse {
  return mock<DeploymentResponse>({
    deployment: {
      id: { owner: "akash1owner", dseq: "1234" },
      state: overrides.state ?? "active",
      hash: "abc123",
      created_at: "12345"
    },
    leases: overrides.leases ?? [createLease()],
    escrow_account: {
      id: { scope: "deployment", xid: "1234" },
      state: {
        owner: "akash1owner",
        state: "open",
        transferred: [],
        settled_at: "12345",
        funds: [{ denom: "uakt", amount: "1000" }],
        deposits: []
      }
    }
  });
}

function createProviderInfo(overrides: Partial<{ hostUri: string }> = {}): ProviderInfo {
  return mock<ProviderInfo>({ hostUri: overrides.hostUri ?? "https://provider.example.com" });
}

describe(ShellExecController.name, () => {
  it("throws 404 when deployment not found", async () => {
    const { controller, deploymentReaderService } = setup();
    // Simulate "deployment not found": clear the default stub so the lookup resolves undefined.
    deploymentReaderService.findByUserIdAndDseq.mockReset();

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Deployment not found");
  });

  it("throws 404 when no lease matches the provided gseq and oseq", async () => {
    const { controller } = setup();

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 99, oseq: 99, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Lease not found");
  });

  it("throws 500 when lease provider address is an empty string", async () => {
    const { controller } = setup({ provider: "" });

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(500);
    expect(error.message).toBe("Lease provider address not found");
  });

  it("throws 400 when lease state is not active", async () => {
    const { controller } = setup({ state: "closed" });

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Lease is not active");
  });

  it("throws 502 when shell exec service returns an error result", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("Command timed out"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Command execution timed out");
  });

  it("returns the shell exec result on successful execution", async () => {
    const { controller, shellExecService } = setup();

    const result = await controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 });

    expect(result).toEqual({ stdout: "output", stderr: "", exitCode: 0, truncated: false });
    expect(shellExecService.execute).toHaveBeenCalledWith({
      providerBaseUrl: "https://provider.example.com",
      providerAddress: "akash1provider",
      dseq: "1234",
      gseq: 1,
      oseq: 1,
      service: "web",
      command: ["ls"],
      timeout: 60,
      jwtToken: "test-token"
    });
  });

  it("forwards stdin through to the shell exec service", async () => {
    const { controller, shellExecService } = setup();
    const secretValue = Math.random().toString(36).substring(2);

    await controller.exec({
      dseq: "1234",
      gseq: 1,
      oseq: 1,
      command: ["sh", "-c", "cat > /run/secrets/.env"],
      service: "web",
      timeout: 60,
      stdin: `SECRET=${secretValue}`
    });

    expect(shellExecService.execute).toHaveBeenCalledWith(expect.objectContaining({ stdin: `SECRET=${secretValue}` }));
  });

  it("throws 404 when provider info lookup returns null", async () => {
    const { controller, providerService } = setup();
    providerService.getProvider.mockResolvedValue(null);

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Provider not found");
  });

  it("does not mint a provider JWT when the provider lookup fails (getProvider precedes toProviderAuth)", async () => {
    const { controller, providerService } = setup();
    providerService.getProvider.mockResolvedValue(null);

    await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(providerService.toProviderAuth).not.toHaveBeenCalled();
  });

  it("throws 404 when deployment has an empty leases array", async () => {
    const { controller, deploymentReaderService } = setup();
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(createDeployment({ leases: [] }));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Lease not found");
  });

  it("finds the correct lease among multiple leases by gseq and oseq", async () => {
    const { controller, deploymentReaderService, shellExecService } = setup();

    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(
      createDeployment({
        leases: [
          createLease({ gseq: 1, oseq: 1 }),
          createLease({ gseq: 2, oseq: 1, provider: "akash1provider2" }),
          createLease({ gseq: 1, oseq: 2, provider: "akash1provider3" })
        ]
      })
    );

    const result = await controller.exec({ dseq: "1234", gseq: 2, oseq: 1, command: ["ls"], service: "web", timeout: 60 });

    expect(result).toEqual({ stdout: "output", stderr: "", exitCode: 0, truncated: false });
    expect(shellExecService.execute).toHaveBeenCalledWith(expect.objectContaining({ providerAddress: "akash1provider2" }));
  });

  it("throws 400 when deployment state is closed", async () => {
    const { controller, deploymentReaderService } = setup();
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(createDeployment({ state: "closed" }));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Deployment is not active");
  });

  it("throws 502 with stable message when WS connection fails", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("WebSocket connection failed: ECONNREFUSED"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Failed to connect to provider");
  });

  it("throws 502 with stable message when provider returns error", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("Provider error: internal error"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Provider returned an error");
  });

  it("throws 502 with auth-expired message when the provider JWT expires mid-run", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("Auth expired: provider closed connection (code 4001)"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: ["ls"], service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Provider authentication expired");
  });

  async function captureError(fn: () => Promise<unknown>): Promise<{ status: number; message: string }> {
    try {
      await fn();
      throw new Error("Expected function to throw");
    } catch (error) {
      return error as { status: number; message: string };
    }
  }

  function setup(overrides?: { provider?: string; state?: string }) {
    const user = createUser();
    const deploymentReaderService = mock<DeploymentReaderService>();
    const providerService = mock<ProviderService>();
    const shellExecService = mock<ShellExecService>();
    const authService = mock<AuthService>({ currentUser: user });
    const walletReaderService = mock<WalletReaderService>();

    container.register(AuthService, { useValue: authService });

    const controller = new ShellExecController(deploymentReaderService, providerService, shellExecService, authService, walletReaderService);

    const provider = overrides?.provider ?? "akash1provider";
    const state = overrides?.state ?? "active";

    const deployment = createDeployment({ leases: [createLease({ provider, state })] });

    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(deployment);
    walletReaderService.getWalletByUserId.mockResolvedValue(
      mock<Awaited<ReturnType<WalletReaderService["getWalletByUserId"]>>>({ id: 1, address: "akash1wallet" })
    );
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt" as const, token: "test-token" });
    providerService.getProvider.mockResolvedValue(createProviderInfo());
    shellExecService.execute.mockResolvedValue(new Ok({ stdout: "output", stderr: "", exitCode: 0, truncated: false }));

    return { controller, deploymentReaderService, providerService, shellExecService, authService, walletReaderService, user, deployment };
  }
});
