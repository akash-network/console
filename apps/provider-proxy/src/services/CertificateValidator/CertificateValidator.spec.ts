import type { LoggerService } from "@akashnetwork/logging";
import type { X509Certificate } from "crypto";
import { setTimeout } from "timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createX509CertPair } from "../../../test/seeders/createX509CertPair";
import type { ProviderService } from "../ProviderService/ProviderService";
import type { CertificateValidatorIntrumentation, CertValidationResultError } from "./CertificateValidator";
import { CertificateValidator, createCertificateValidatorInstrumentation } from "./CertificateValidator";

describe(CertificateValidator.name, () => {
  const ONE_MINUTE = 60 * 1000;
  const THIRTY_MINUTES = 30 * ONE_MINUTE;
  const PROVIDER_ADDRESS = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";

  it('returns "unknownCertificate" error result if provider certificate cannot be found', async () => {
    const { cert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = vi.fn(() => Promise.resolve(null));
    const validator = setup({ getCertificate });

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("unknownCertificate");
    expect(getCertificate).toHaveBeenCalledWith("provider", cert.serialNumber);
  });

  it('returns "fingerprintMismatch" error result if certificate fingerprint does not match', async () => {
    const { cert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = vi.fn(() =>
      createX509CertPair({
        validFrom: new Date(),
        validTo: new Date(Date.now() + ONE_MINUTE),
        commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
        serialNumber: "177831BE7F249E61"
      }).then(x => x.cert)
    );
    const validator = setup({ getCertificate });

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("fingerprintMismatch");
    expect(getCertificate).toHaveBeenCalledWith("provider", cert.serialNumber);
  });

  it("caches provider certificate per provider and serial number", async () => {
    const { cert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const { cert: anotherCert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + 2 * ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E11"
    });
    const getCertificate = vi.fn().mockReturnValueOnce(Promise.resolve(cert)).mockReturnValueOnce(Promise.resolve(anotherCert)).mockReturnValue(null);
    const validator = setup({ getCertificate });

    let result = await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledWith("provider", cert.serialNumber);
    expect(result.ok).toBe(true);

    result = await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);

    result = await validator.validate(anotherCert, "provider");
    expect(getCertificate).toHaveBeenCalledWith("provider", anotherCert.serialNumber);
    expect(result.ok).toBe(true);

    result = await validator.validate(anotherCert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("rechecks a known certificate with chain once 30 minutes have passed since chain confirmed it", async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const clock = { now: Date.now() };
    const getCertificate = vi.fn(() => Promise.resolve(cert));
    const validator = setup({ getCertificate, now: () => clock.now });

    await validator.validate(cert, "provider");
    clock.now += THIRTY_MINUTES - 1;
    await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(1);

    clock.now += 1;
    const result = await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("rechecks a known certificate with chain once the clock moved back past the time chain confirmed it", async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const clock = { now: Date.now() };
    const getCertificate = vi.fn(() => Promise.resolve(cert));
    const validator = setup({ getCertificate, now: () => clock.now });

    await validator.validate(cert, "provider");
    await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(1);

    clock.now -= 1;
    await validator.validate(cert, "provider");
    expect(getCertificate).toHaveBeenCalledTimes(2);
  });

  it("validates against the last certificate chain confirmed while chain cannot be queried", async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const clock = { now: Date.now() };
    const getCertificate = vi.fn().mockResolvedValueOnce(cert).mockRejectedValue(new Error("chain is halted"));
    const validator = setup({ getCertificate, now: () => clock.now });

    await validator.validate(cert, "provider");
    clock.now += 2 * THIRTY_MINUTES;
    const result = await validator.validate(cert, "provider");

    expect(getCertificate).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("reports when the last certificate chain confirmed stands in for chain", async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const clock = { now: Date.now() };
    const getCertificate = vi.fn().mockResolvedValueOnce(cert).mockRejectedValue(new Error("chain is halted"));
    const instrumentation = mock<CertificateValidatorIntrumentation>();
    const validator = setup({ getCertificate, now: () => clock.now, instrumentation });

    await validator.validate(cert, "provider");
    clock.now += THIRTY_MINUTES;
    await validator.validate(cert, "provider");

    expect(instrumentation.onLastKnownCertUsed).toHaveBeenCalledWith(cert, "provider");
  });

  it('returns "unknownCertificate" error result if chain cannot be queried and no certificate is known', async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const getCertificate = vi.fn(() => Promise.reject(new Error("chain is halted")));
    const instrumentation = mock<CertificateValidatorIntrumentation>();
    const validator = setup({ getCertificate, instrumentation });

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("unknownCertificate");
    expect(instrumentation.onLastKnownCertUsed).not.toHaveBeenCalled();
  });

  it("does not fall back to a certificate chain stopped reporting", async () => {
    const { cert } = await createX509CertPair({ commonName: PROVIDER_ADDRESS });
    const clock = { now: Date.now() };
    const getCertificate = vi.fn().mockResolvedValueOnce(cert).mockResolvedValueOnce(null).mockRejectedValue(new Error("chain is halted"));
    const validator = setup({ getCertificate, now: () => clock.now });

    await validator.validate(cert, "provider");
    clock.now += THIRTY_MINUTES;
    const revokedResult = (await validator.validate(cert, "provider")) as CertValidationResultError;
    const haltedResult = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(revokedResult.code).toBe("unknownCertificate");
    expect(haltedResult.code).toBe("unknownCertificate");
    expect(getCertificate).toHaveBeenCalledTimes(3);
  });

  it("returns error if certificate is issued for future use", async () => {
    const validFrom = new Date();
    const { cert } = await createX509CertPair({ validFrom });
    const validator = setup({ now: () => validFrom.getTime() - ONE_MINUTE });

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validInFuture");
  });

  it("returns error if certificate expired", async () => {
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 60 * 1000);
    const { cert } = await createX509CertPair({ validFrom, validTo });
    const validator = setup({ now: () => validTo.getTime() + ONE_MINUTE });

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
  });

  it("returns error if certificate does not have serial number", async () => {
    const cert = Object.create((await createX509CertPair()).cert) as X509Certificate;
    Object.defineProperty(cert, "serialNumber", { get: () => "" });
    const validator = setup();

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalidSerialNumber");
  });

  it("returns error if certificate subject common name is not in bech32 format", async () => {
    const { cert } = await createX509CertPair({ commonName: "test.com" });
    const validator = setup();

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns error if certificate subject common name is not in bech32 format", async () => {
    const { cert } = await createX509CertPair();
    const validator = setup();

    const result = (await validator.validate(cert, "provider")) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns successful result if all criterias above are met", async () => {
    const { cert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = () => Promise.resolve(cert);
    const validator = setup({ getCertificate });

    const result = await validator.validate(cert, "provider");

    expect(result.ok).toBe(true);
  });

  it("fetches provider certificate only once for concurrent validation of the same certificate", async () => {
    const { cert } = await createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const getCertificate = vi.fn(() => setTimeout(20, cert));
    const validator = setup({ getCertificate });

    const results = await Promise.all([
      // keep-newline
      validator.validate(cert, "provider"),
      validator.validate(cert, "provider"),
      validator.validate(cert, "provider"),
      validator.validate(cert, "provider")
    ]);

    expect(getCertificate).toHaveBeenCalledTimes(1);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);
  });

  function setup(params?: Params) {
    return new CertificateValidator(
      params?.now ?? Date.now,
      {
        getCertificate: params?.getCertificate || vi.fn()
      } as ProviderService,
      params?.instrumentation
    );
  }

  interface Params {
    now?: () => number;
    getCertificate?: ProviderService["getCertificate"];
    instrumentation?: CertificateValidatorIntrumentation;
  }
});

describe(createCertificateValidatorInstrumentation.name, () => {
  it("logs the provider and serial number when the last known certificate stands in for chain", async () => {
    const { cert } = await createX509CertPair({ serialNumber: "177831BE7F249E66" });
    const logger = mock<LoggerService>();
    const instrumentation = createCertificateValidatorInstrumentation(logger);

    instrumentation.onLastKnownCertUsed?.(cert, "provider");

    expect(logger.warn).toHaveBeenCalledWith({
      event: "LAST_KNOWN_PROVIDER_CERTIFICATE_USED",
      serialNumber: "177831BE7F249E66",
      providerAddress: "provider"
    });
  });
});
