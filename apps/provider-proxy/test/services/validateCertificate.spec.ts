import { X509Certificate } from "crypto";

import { CertValidationResultError, validateCertificate } from "../../src/utils/validateCertificate";
import { createX509CertPair } from "../seeders/createX509CertPair";

describe(validateCertificate.name, () => {
  const ONE_MINUTE = 60 * 1000;

  it("returns error if certificate is issued for future use", () => {
    const validFrom = new Date();
    const { cert } = createX509CertPair({ validFrom });

    const result = validateCertificate(cert, validFrom.getTime() - ONE_MINUTE) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validInFuture");
  });

  it("returns error if certificate expired", () => {
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 60 * 1000);
    const { cert } = createX509CertPair({ validFrom, validTo });

    const result = validateCertificate(cert, validTo.getTime() + ONE_MINUTE) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("expired");
  });

  it("returns error if certificate does not have serial number", () => {
    const cert = Object.create(createX509CertPair().cert) as X509Certificate;
    Object.defineProperty(cert, "serialNumber", { get: () => "" });

    const result = validateCertificate(cert, Date.now()) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalidSerialNumber");
  });

  it("returns error if certificate subject common name is not in bech32 format", () => {
    const { cert } = createX509CertPair({ commonName: "test.com" });
    const result = validateCertificate(cert, Date.now()) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns error if certificate subject common name is not in bech32 format", () => {
    const { cert } = createX509CertPair();
    const result = validateCertificate(cert, Date.now()) as CertValidationResultError;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CommonNameIsNotBech32");
  });

  it("returns successful result if all criterias above are met", () => {
    const { cert } = createX509CertPair({
      validFrom: new Date(),
      validTo: new Date(Date.now() + ONE_MINUTE),
      commonName: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
      serialNumber: "177831BE7F249E66"
    });
    const result = validateCertificate(cert, Date.now());

    expect(result.ok).toBe(true);
  });
});
