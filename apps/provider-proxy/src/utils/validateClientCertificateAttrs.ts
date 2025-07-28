import { X509Certificate } from "crypto";

import type { CertValidationResult } from "./validateCertificateAttrs";
import { validateCertificateAttrs } from "./validateCertificateAttrs";

export function validateClientCertificateAttrs(certPem: string): CertValidationResult | { ok: false; code: "invalid" } {
  const cert = parseCertificate(certPem);
  if (!cert) return { ok: false, code: "invalid" };

  return validateCertificateAttrs(cert, Date.now());
}

function parseCertificate(certPem: string) {
  try {
    return new X509Certificate(certPem);
  } catch {
    return null;
  }
}
