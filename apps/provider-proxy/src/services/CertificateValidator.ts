import type { LoggerService } from "@akashnetwork/logging";
import type { SupportedChainNetworks } from "@akashnetwork/net";
import { bech32 } from "bech32";
import type { X509Certificate } from "crypto";
import { LRUCache } from "lru-cache";

import type { ProviderService } from "./ProviderService";

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

  async validate(certificate: X509Certificate, network: SupportedChainNetworks, providerAddress: string): Promise<CertValidationResult> {
    const now = this.now();
    const validationResult = validateCertificateAttrs(certificate, now);

    if (validationResult.ok === false) {
      this.instrumentation?.onInvalidAttrs?.(certificate, network, providerAddress, now, validationResult);
      return validationResult;
    }

    const providerCertificate = await this.getProviderCertificate(certificate, network, providerAddress);
    if (!providerCertificate) {
      this.instrumentation?.onUnknownCert?.(certificate, network, providerAddress);
      return { ok: false, code: "unknownCertificate" };
    }

    if (providerCertificate.fingerprint256 !== certificate.fingerprint256) {
      this.instrumentation?.onInvalidFingerprint?.(certificate, network, providerAddress, providerCertificate);
      return { ok: false, code: "fingerprintMismatch" };
    }

    this.instrumentation?.onValidationSuccess?.(certificate, network, providerAddress, now);

    return { ok: true };
  }

  private async getProviderCertificate(cert: X509Certificate, network: SupportedChainNetworks, providerAddress: string): Promise<X509Certificate | null> {
    const key = `${network}.${providerAddress}.${cert.serialNumber}`;

    if (this.knownCertificatesCache.has(key)) {
      return this.knownCertificatesCache.get(key)!;
    }

    try {
      this.inflightCertificates[key] ??= this.providerService.getCertificate(network, providerAddress, cert.serialNumber);
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
  onValidationSuccess?(certificate: X509Certificate, network: SupportedChainNetworks, providerAddress: string, now: number): void;
  onInvalidAttrs?(
    certificate: X509Certificate,
    network: SupportedChainNetworks,
    providerAddress: string,
    now: number,
    validationResult: CertValidationResultError
  ): void;
  onUnknownCert?(certificate: X509Certificate, network: SupportedChainNetworks, providerAddress: string): void;
  onInvalidFingerprint?(certificate: X509Certificate, network: SupportedChainNetworks, providerAddress: string, providerCertificate: X509Certificate): void;
}

function validateCertificateAttrs(cert: X509Certificate, now: number): CertValidationResult {
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

function parseCertSubject(subject: string, attr: string): string | null {
  const attrPrefix = `${attr}=`;
  const index = subject.indexOf(attrPrefix);
  if (index === -1) return null;

  const endIndex = subject.indexOf("\n", index);
  if (endIndex === -1) return subject.slice(index);

  return subject.slice(index + attrPrefix.length, endIndex);
}

export const createCertificateValidatorInstrumentation = (logger: LoggerService): CertificateValidatorIntrumentation => ({
  onValidationSuccess(certificate, network, providerAddress, now) {
    logger.info(`Successfully validated ${certificate.serialNumber} in ${network} for "${providerAddress}" at ${now}`);
  },
  onInvalidAttrs(certificate, network, providerAddress, now, result) {
    logger.warn(`Certificate ${certificate.serialNumber} is invalid in ${network} for "${providerAddress}" because ${result.code} at ${now}`);
  },
  onInvalidFingerprint(certificate, network, providerAddress, providerCertificate) {
    logger.warn(
      `Certificate ${certificate.serialNumber} (${certificate.fingerprint256}) fingerprint does not match fingerprint in ${network} for ${providerAddress}: ${providerCertificate.fingerprint256}`
    );
  },
  onUnknownCert(certificate, network, providerAddress) {
    logger.warn(`Certificate ${certificate.serialNumber} does not have corresponding certificate in ${network} for ${providerAddress}`);
  }
});
