import { bech32 } from "bech32";
import { X509Certificate } from "crypto";

export function validateCertificate(cert: X509Certificate, now: number): CertValidationResult {
  if (new Date(cert.validFrom).getTime() > now) {
    return {
      ok: false,
      code: "validInFuture"
    };
  }

  if (new Date(cert.validTo).getTime() < now) {
    return {
      ok: false,
      code: "expired"
    };
  }

  if (!cert.serialNumber?.trim()) {
    return {
      ok: false,
      code: "invalidSerialNumber"
    };
  }

  if (cert.issuer !== cert.subject) {
    return {
      ok: false,
      code: "notSelfSigned"
    };
  }

  const commonName = parseCertSubject(cert.subject, "CN");
  if (!commonName || !bech32.decodeUnsafe(commonName)) {
    return {
      ok: false,
      code: "CommonNameIsNotBech32"
    };
  }

  return { ok: true };
}

export type CertValidationResult = CertValidationResultError | { ok: true };
export type CertValidationResultError = { ok: false; code: "validInFuture" | "expired" | "invalidSerialNumber" | "notSelfSigned" | "CommonNameIsNotBech32" };

function parseCertSubject(subject: string, attr: string): string | null {
  const attrPrefix = `${attr}=`;
  const index = subject.indexOf(attrPrefix);
  if (index === -1) return null;

  const endIndex = subject.indexOf("\n", index);
  if (endIndex === -1) return subject.slice(index);

  return subject.slice(index + attrPrefix.length, endIndex);
}
