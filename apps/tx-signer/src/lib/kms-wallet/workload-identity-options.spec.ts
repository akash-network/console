import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { workloadIdentityOptions } from "./workload-identity-options";

const AUDIENCE = "//iam.googleapis.com/projects/1234/locations/global/workloadIdentityPools/console/providers/cluster";

describe(workloadIdentityOptions.name, () => {
  it("exchanges the workload's own token at the given provider, with no stored credential", () => {
    const options = workloadIdentityOptions({ audience: AUDIENCE, tokenFile: "/unused" });

    expect(options).toEqual({
      type: "external_account",
      audience: AUDIENCE,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      subject_token_supplier: { getSubjectToken: expect.any(Function) }
    });
  });

  it("acts as the service account when one is named", () => {
    const options = workloadIdentityOptions({ audience: AUDIENCE, tokenFile: "/unused", serviceAccount: "tx-signer@console.iam.gserviceaccount.com" });

    expect(options.service_account_impersonation_url).toBe(
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/tx-signer@console.iam.gserviceaccount.com:generateAccessToken"
    );
  });

  it("supplies the token file's content without the trailing newline", async () => {
    const { tokenFile, removeTokenFile } = await setup({ content: "header.payload.signature\n" });

    try {
      const options = workloadIdentityOptions({ audience: AUDIENCE, tokenFile });

      await expect(options.subject_token_supplier!.getSubjectToken(expect.anything())).resolves.toBe("header.payload.signature");
    } finally {
      await removeTokenFile();
    }
  });

  it("reads the token file again on each exchange, since the cluster replaces it before it expires", async () => {
    const { tokenFile, removeTokenFile } = await setup({ content: "first" });

    try {
      const { subject_token_supplier: supplier } = workloadIdentityOptions({ audience: AUDIENCE, tokenFile });
      await supplier!.getSubjectToken(expect.anything());
      await writeFile(tokenFile, "second");

      await expect(supplier!.getSubjectToken(expect.anything())).resolves.toBe("second");
    } finally {
      await removeTokenFile();
    }
  });

  it("fails the exchange when the token file is missing", async () => {
    const options = workloadIdentityOptions({ audience: AUDIENCE, tokenFile: join(tmpdir(), "no-such-dir", "token") });

    await expect(options.subject_token_supplier!.getSubjectToken(expect.anything())).rejects.toThrow(/ENOENT/);
  });

  async function setup(input: { content: string }) {
    const directory = await mkdtemp(join(tmpdir(), "workload-identity-"));
    const tokenFile = join(directory, "token");
    await writeFile(tokenFile, input.content);

    return { tokenFile, removeTokenFile: () => rm(directory, { recursive: true }) };
  }
});
