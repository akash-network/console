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

describe(ShellExecController.name, () => {
  it("throws 404 when deployment not found", async () => {
    const { controller, deploymentReaderService } = setup();
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(undefined as never);

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Deployment not found");
  });

  it("throws 404 when no lease matches the provided gseq and oseq", async () => {
    const { controller } = setup();

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 99, oseq: 99, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Lease not found");
  });

  it("throws 500 when lease provider address is an empty string", async () => {
    const { controller } = setup({ provider: "" });

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(500);
    expect(error.message).toBe("Lease provider address not found");
  });

  it("throws 400 when lease state is not active", async () => {
    const { controller } = setup({ state: "closed" });

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Lease is not active");
  });

  it("throws 502 when shell exec service returns an error result", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("Command timed out"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Command execution timed out");
  });

  it("returns the shell exec result on successful execution", async () => {
    const { controller, shellExecService } = setup();

    const result = await controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 });

    expect(result).toEqual({ stdout: "output", stderr: "", exitCode: 0, truncated: false });
    expect(shellExecService.execute).toHaveBeenCalledWith({
      providerBaseUrl: "https://provider.example.com",
      providerAddress: "akash1provider",
      dseq: "1234",
      gseq: 1,
      oseq: 1,
      service: "web",
      command: "ls",
      timeout: 60,
      jwtToken: "test-token"
    });
  });

  it("throws 404 when provider info lookup returns null", async () => {
    const { controller, providerService } = setup();
    providerService.getProvider.mockResolvedValue(null as never);

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Provider not found");
  });

  it("throws 404 when deployment has an empty leases array", async () => {
    const { controller, deploymentReaderService, deployment } = setup();
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue({ ...deployment, leases: [] } as never);

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(404);
    expect(error.message).toBe("Lease not found");
  });

  it("finds the correct lease among multiple leases by gseq and oseq", async () => {
    const { controller, deploymentReaderService, deployment, shellExecService } = setup();

    const multiLeaseDeployment = {
      ...deployment,
      leases: [
        { ...deployment.leases[0], id: { ...deployment.leases[0].id, gseq: 1, oseq: 1 }, state: "active" },
        { ...deployment.leases[0], id: { ...deployment.leases[0].id, gseq: 2, oseq: 1, provider: "akash1provider2" }, state: "active" },
        { ...deployment.leases[0], id: { ...deployment.leases[0].id, gseq: 1, oseq: 2, provider: "akash1provider3" }, state: "active" }
      ]
    };
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(multiLeaseDeployment as never);

    const result = await controller.exec({ dseq: "1234", gseq: 2, oseq: 1, command: "ls", service: "web", timeout: 60 });

    expect(result).toEqual({ stdout: "output", stderr: "", exitCode: 0, truncated: false });
    expect(shellExecService.execute).toHaveBeenCalledWith(expect.objectContaining({ providerAddress: "akash1provider2" }));
  });

  it("throws 400 when deployment state is closed", async () => {
    const { controller, deploymentReaderService, deployment } = setup();
    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue({ ...deployment, deployment: { ...deployment.deployment, state: "closed" } } as never);

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Deployment is not active");
  });

  it("throws 502 with stable message when WS connection fails", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("WebSocket connection failed: ECONNREFUSED"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Failed to connect to provider");
  });

  it("throws 502 with stable message when provider returns error", async () => {
    const { controller, shellExecService } = setup();
    shellExecService.execute.mockResolvedValue(Err("Provider error: internal error"));

    const error = await captureError(() => controller.exec({ dseq: "1234", gseq: 1, oseq: 1, command: "ls", service: "web", timeout: 60 }));

    expect(error.status).toBe(502);
    expect(error.message).toBe("Provider returned an error");
  });

  async function captureError(fn: () => Promise<any>): Promise<any> {
    try {
      await fn();
      throw new Error("Expected function to throw");
    } catch (error) {
      return error;
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

    const deployment = {
      deployment: {
        id: { owner: "akash1owner", dseq: "1234" },
        state: "active",
        hash: "abc123",
        created_at: "12345"
      },
      leases: [
        {
          id: { owner: "akash1owner", dseq: "1234", gseq: 1, oseq: 1, provider, bseq: 0 },
          state,
          price: { denom: "uakt", amount: "100" },
          created_at: "12345",
          closed_on: "0",
          status: null
        }
      ],
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
    };

    deploymentReaderService.findByUserIdAndDseq.mockResolvedValue(deployment as never);
    walletReaderService.getWalletByUserId.mockResolvedValue({ id: 1, address: "akash1wallet" } as never);
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt" as const, token: "test-token" });
    providerService.getProvider.mockResolvedValue({ hostUri: "https://provider.example.com" } as never);
    shellExecService.execute.mockResolvedValue(new Ok({ stdout: "output", stderr: "", exitCode: 0, truncated: false }));

    return { controller, deploymentReaderService, providerService, shellExecService, authService, walletReaderService, user, deployment };
  }
});
