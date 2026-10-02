import { fromBech32, toBech32 } from "@cosmjs/encoding";
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

  it("rejects an mtls private key that belongs to another certificate", async () => {
    const { schema, certPem, keyPemOfAnotherCertificate } = await setup();

    const result = schema.safeParse({
      url: PROVIDER_URL,
      providerAddress: PROVIDER_ADDRESS,
      auth: { type: "mtls", certPem, keyPem: keyPemOfAnotherCertificate }
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        code: "custom",
        message: "does not match the certificate",
        path: ["auth", "keyPem"],
        params: { reason: "mismatch" }
      })
    ]);
  });

  it("reports only the certificate when the certificate cannot be read", async () => {
    const { schema, keyPem } = await setup();

    const result = schema.safeParse({
      url: PROVIDER_URL,
      providerAddress: PROVIDER_ADDRESS,
      auth: { type: "mtls", certPem: "not a certificate", keyPem }
    });

    expect(result.error?.issues).toEqual([expect.objectContaining({ path: ["auth", "certPem"], params: { reason: "invalid" } })]);
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

  it.each([
    ["another chain's prefix", toBech32("cosmos", fromBech32(PROVIDER_ADDRESS).data)],
    ["a prefix carrying path characters", toBech32("../../x?", fromBech32(PROVIDER_ADDRESS).data)],
    ["a string that is not bech32", "akash1notanaddress"]
  ])("rejects a provider address with %s", async (_label, providerAddress) => {
    const { schema } = await setup();

    const result = schema.safeParse({ url: PROVIDER_URL, providerAddress });

    expect(result.error?.issues).toEqual([expect.objectContaining({ path: ["providerAddress"], message: "is not an akash bech32 address" })]);
  });

  async function setup() {
    const certPair = await createX509CertPair({ commonName: PROVIDER_ADDRESS, validFrom: new Date(Date.now() - ONE_HOUR) });
    const anotherCertPair = await createX509CertPair({ commonName: PROVIDER_ADDRESS, validFrom: new Date(Date.now() - ONE_HOUR) });

    return {
      schema: addProviderAuthValidation(providerRequestSchema),
      certPem: certPair.cert.toString(),
      keyPem: certPair.key,
      keyPemOfAnotherCertificate: anotherCertPair.key
    };
  }
});
