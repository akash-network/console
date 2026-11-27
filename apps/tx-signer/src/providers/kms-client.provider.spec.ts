import { KeyManagementServiceClient } from "@google-cloud/kms";
import { IdentityPoolClient } from "google-auth-library";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnvConfig } from "@src/config/env.config";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { KMS_CLIENT } from "./kms-client.provider";

const AUDIENCE = "//iam.googleapis.com/projects/1234/locations/global/workloadIdentityPools/console/providers/cluster";

describe("KMS_CLIENT", () => {
  it("refuses to build a client without a workload identity to reach Cloud KMS with", () => {
    const { resolveClient } = setup({});

    expect(() => resolveClient()).toThrow("GCP_WORKLOAD_IDENTITY_AUDIENCE is required to reach Cloud KMS");
  });

  it("builds a Cloud KMS client that signs in as the workload identity it is configured with", async () => {
    const { resolveClient } = setup({ GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE, GCP_KMS_SERVICE_ACCOUNT: "tx-signer@console.iam.gserviceaccount.com" });

    const client = resolveClient() as KeyManagementServiceClient;
    const authClient = (await client.auth.getClient()) as IdentityPoolClient;

    expect(client).toBeInstanceOf(KeyManagementServiceClient);
    expect(authClient).toBeInstanceOf(IdentityPoolClient);
    expect(authClient.projectNumber).toBe("1234");
    expect(authClient.getServiceAccountEmail()).toBe("tx-signer@console.iam.gserviceaccount.com");
  });

  it("signs in as the workload identity itself when no service account is named", async () => {
    const { resolveClient } = setup({ GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE });

    const authClient = (await (resolveClient() as KeyManagementServiceClient).auth.getClient()) as IdentityPoolClient;

    expect(authClient.getServiceAccountEmail()).toBeNull();
  });

  it("builds one client per container", () => {
    const { resolveClient } = setup({ GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE });

    expect(resolveClient()).toBe(resolveClient());
  });

  function setup(input: Partial<Pick<EnvConfig, "GCP_WORKLOAD_IDENTITY_AUDIENCE" | "GCP_KMS_SERVICE_ACCOUNT">>) {
    const config: Partial<EnvConfig> = { GCP_WORKLOAD_IDENTITY_TOKEN_FILE: "/var/run/secrets/gcp-workload-identity/token", ...input };
    const appConfigService = mock<AppConfigService>();
    appConfigService.get.mockImplementation(((key: keyof EnvConfig) => config[key]) as AppConfigService["get"]);
    const childContainer = container.createChildContainer();
    childContainer.registerInstance(AppConfigService, appConfigService);

    return { resolveClient: () => childContainer.resolve(KMS_CLIENT) };
  }
});
