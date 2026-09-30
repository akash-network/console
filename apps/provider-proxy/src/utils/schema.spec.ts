import { describe, expect, it } from "vitest";

import { createX509CertPair } from "../../test/seeders/createX509CertPair";
import { addProviderAuthValidation, providerRequestSchema } from "./schema";

describe(addProviderAuthValidation.name, () => {
  const ONE_HOUR = 60 * 60 * 1000;
  const PROVIDER_ADDRESS = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";
  const PROVIDER_URL = "https://provider.example.com:8443/status";

  it("rejects an mtls private key that cannot be read", async () => {
    const { schema, certPem, keyPem } = await setup();
    const keyPemWithEscapedNewlines = keyPem.replaceAll(/\r?\n/g, "\\n");

    const result = schema.safeParse({
      url: PROVIDER_URL,
      providerAddress: PROVIDER_ADDRESS,
      auth: { type: "mtls", certPem, keyPem: keyPemWithEscapedNewlines }
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        code: "custom",
        message: "is not a valid private key",
        path: ["auth", "keyPem"],
        params: { reason: "invalid" }
      })
    ]);
  });

  it("accepts a readable mtls private key", async () => {
    const { schema, certPem, keyPem } = await setup();

    const result = schema.safeParse({
      url: PROVIDER_URL,
      providerAddress: PROVIDER_ADDRESS,
      auth: { type: "mtls", certPem, keyPem }
    });

    expect(result.error).toBeUndefined();
  });

  it("accepts a request without auth", async () => {
    const { schema } = await setup();

    const result = schema.safeParse({ url: PROVIDER_URL, providerAddress: PROVIDER_ADDRESS });

    expect(result.error).toBeUndefined();
  });

  async function setup() {
    const certPair = await createX509CertPair({ commonName: PROVIDER_ADDRESS, validFrom: new Date(Date.now() - ONE_HOUR) });

    return {
      schema: addProviderAuthValidation(providerRequestSchema),
      certPem: certPair.cert.toString(),
      keyPem: certPair.key
    };
  }
});
