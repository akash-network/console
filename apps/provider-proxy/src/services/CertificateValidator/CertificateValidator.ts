import type { LoggerService } from "@akashnetwork/logging";
import type { X509Certificate } from "crypto";
import { LRUCache } from "lru-cache";

import { validateCertificateAttrs } from "../../utils/validateCertificateAttrs";
import type { ProviderService } from "../ProviderService/ProviderService";

export class CertificateValidator {
  private readonly knownCertificatesCache = new LRUCache<string, X509Certificate>({
    max: 100_000,
    ttl: 30 * 60 * 1000
  });
  private readonly inflightCertificates: Record<string, Promise<X509Certificate | null>> = {};

  constructor(
    private readonly now: () => number,
    private readonly providerService: ProviderService,
    private readonly instrumentation?: CertificateValidatorIntrumentation
  ) {}

  async validate(certificate: X509Certificate, providerAddress: string): Promise<CertValidationResult> {
    const now = this.now();
    const validationResult = validateCertificateAttrs(certificate, now);

    if (validationResult.ok === false) {
      this.instrumentation?.onInvalidAttrs?.(certificate, providerAddress, now, validationResult);
      return validationResult;
    }

    const providerCertificate = await this.getProviderCertificate(certificate, providerAddress);
    if (!providerCertificate) {
      this.instrumentation?.onUnknownCert?.(certificate, providerAddress);
      return { ok: false, code: "unknownCertificate" };
    }

    if (providerCertificate.fingerprint256 !== certificate.fingerprint256) {
      this.instrumentation?.onInvalidFingerprint?.(certificate, providerAddress, providerCertificate);
      return { ok: false, code: "fingerprintMismatch" };
    }

    this.instrumentation?.onValidationSuccess?.(certificate, providerAddress, now);

    return { ok: true };
  }

  private async getProviderCertificate(cert: X509Certificate, providerAddress: string): Promise<X509Certificate | null> {
    const key = `${providerAddress}.${cert.serialNumber}`;

    if (this.knownCertificatesCache.has(key)) {
      return this.knownCertificatesCache.get(key)!;
    }

    try {
      this.inflightCertificates[key] ??= this.providerService.getCertificate(providerAddress, cert.serialNumber);
      const certificate = await this.inflightCertificates[key];
      if (certificate) this.knownCertificatesCache.set(key, certificate);

      return certificate;
    } finally {
      delete this.inflightCertificates[key];
    }
  }
}

export type CertValidationResult = { ok: true } | CertValidationResultError;
export type CertValidationResultError = {
  ok: false;
  code: "validInFuture" | "expired" | "invalidSerialNumber" | "notSelfSigned" | "CommonNameIsNotBech32" | "unknownCertificate" | "fingerprintMismatch";
};
export interface CertificateValidatorIntrumentation {
  onValidationSuccess?(certificate: X509Certificate, providerAddress: string, now: number): void;
  onInvalidAttrs?(certificate: X509Certificate, providerAddress: string, now: number, validationResult: CertValidationResultError): void;
  onUnknownCert?(certificate: X509Certificate, providerAddress: string): void;
  onInvalidFingerprint?(certificate: X509Certificate, providerAddress: string, providerCertificate: X509Certificate): void;
}

export const createCertificateValidatorInstrumentation = (logger: LoggerService): CertificateValidatorIntrumentation => ({
  onValidationSuccess(certificate, providerAddress, now) {
    logger.info(`Successfully validated ${certificate.serialNumber} for "${providerAddress}" at ${now}`);
  },
  onInvalidAttrs(certificate, providerAddress, now, result) {
    logger.warn(`Certificate ${certificate.serialNumber} is invalid for "${providerAddress}" because ${result.code} at ${now}`);
  },
  onInvalidFingerprint(certificate, providerAddress, providerCertificate) {
    logger.warn(
      `Certificate ${certificate.serialNumber} (${certificate.fingerprint256}) fingerprint does not match fingerprint for ${providerAddress}: ${providerCertificate.fingerprint256}`
    );
  },
  onUnknownCert(certificate, providerAddress) {
    logger.warn(`Certificate ${certificate.serialNumber} does not have corresponding certificate for ${providerAddress}`);
  }
});
