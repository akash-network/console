import type { X509Certificate } from "crypto";
import { setTimeout } from "timers/promises";

import type { CertificateValidatorIntrumentation, CertValidationResultError } from "../../src/services/CertificateValidator";
import { CertificateValidator } from "../../src/services/CertificateValidator";
import type { ProviderService } from "../../src/services/ProviderService";
import { createX509CertPair } from "../seeders/createX509CertPair";

describe(CertificateValidator.name, () => {
  const ONE_MINUTE = 60 * 1000;

  it('returns "unknownCertificate" error result if provider certificate cannot be found', async () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = jest.fn(() => Promise.resolve(null));
    const validator = setup({ getCertificate });

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("unknownCertificate");
    expect(getCertificate).toHaveBeenCalledWith("mainnet", "provider", cert.serialNumber);
  });

  it('returns "fingerprintMismatch" error result if certificate fingerprint does not match', async () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = jest.fn(() =>
      Promise.resolve(
        createX509CertPair({
          validFrom: new Date(),
          validTo: new Date(Date.now() + ONE_MINUTE),
          commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
          serialNumber: "177831BE7F249E61"
        }).cert
      )
    );
    const validator = setup({ getCertificate });

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("fingerprintMismatch");
    expect(getCertificate).toHaveBeenCalledWith("mainnet", "provider", cert.serialNumber);
  });

  it("caches provider certificate per network, provider and serial number", async () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const { cert: anotherCert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + 2 * ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E11"
    });
    const getCertificate = jest.fn().mockReturnValueOnce(Promise.resolve(cert)).mockReturnValueOnce(Promise.resolve(anotherCert)).mockReturnValue(null);
    const validator = setup({ getCertificate });

    let result = await validator.validate(cert, "mainnet", "provider");
    expect(getCertificate).toHaveBeenCalledWith("mainnet", "provider", cert.serialNumber);
    expect(result.ok).toBe(true);

    result = await validator.validate(cert, "mainnet", "provider");
    expect(getCertificate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);

    result = await validator.validate(anotherCert, "sandbox", "provider");
    expect(getCertificate).toHaveBeenCalledWith("sandbox", "provider", anotherCert.serialNumber);
    expect(result.ok).toBe(true);

    result = await validator.validate(anotherCert, "sandbox", "provider");
    expect(getCertificate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("returns error if certificate is issued for future use", async () => {
    const validFrom = new Date();
    const { cert } = createX509CertPair({ validFrom });
    const validator = setup({ now: validFrom.getTime() - ONE_MINUTE });

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validInFuture");
  });

  it("returns error if certificate expired", async () => {
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 60 * 1000);
    const { cert } = createX509CertPair({ validFrom, validTo });
    const validator = setup({ now: validTo.getTime() + ONE_MINUTE });

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
  });

  it("returns error if certificate does not have serial number", async () => {
    const cert = Object.create(createX509CertPair().cert) as X509Certificate;
    Object.defineProperty(cert, "serialNumber", { get: () => "" });
    const validator = setup();

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalidSerialNumber");
  });

  it("returns error if certificate subject common name is not in bech32 format", async () => {
    const { cert } = createX509CertPair({ commonName: "test.com" });
    const validator = setup();

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns error if certificate subject common name is not in bech32 format", async () => {
    const { cert } = createX509CertPair();
    const validator = setup();

    const result = (await validator.validate(cert, "mainnet", "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns successful result if all criterias above are met", async () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = () => Promise.resolve(cert);
    const validator = setup({ getCertificate });

    const result = await validator.validate(cert, "mainnet", "provider");

    expect(result.ok).toBe(true);
  });

  it("fetches provider certificate only once for concurrent validation of the same certificate", async () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = jest.fn(() => setTimeout(20, cert));
    const validator = setup({ getCertificate });

    const results = await Promise.all([
      // keep-newline
      validator.validate(cert, "mainnet", "provider"),
      validator.validate(cert, "mainnet", "provider"),
      validator.validate(cert, "mainnet", "provider"),
      validator.validate(cert, "mainnet", "provider")
    ]);

    expect(getCertificate).toHaveBeenCalledTimes(1);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);
  });

  function setup(params?: Params) {
    return new CertificateValidator(
      () => params?.now ?? Date.now(),
      {
        getCertificate: params?.getCertificate || jest.fn()
      } as ProviderService,
      params?.instrumentation
    );
  }

  interface Params {
    now?: number;
    getCertificate?: ProviderService["getCertificate"];
    instrumentation?: CertificateValidatorIntrumentation;
  }
});
