import { X509Certificate } from "crypto";
import { pki } from "node-forge";

export function createX509CertPair(options: CertificateOptions = {}): CertPair {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = options.serialNumber ?? "01";
  cert.validity.notBefore = options.validFrom || new Date();
  cert.validity.notAfter = options.validTo || nextDay(cert.validity.notBefore);

  const attrs = [
    { name: "commonName", value: options?.commonName ?? "example.org" },
    { name: "countryName", value: "US" },
    { shortName: "ST", value: "Virginia" }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  return {
    cert: new X509Certificate(pki.certificateToPem(cert)),
    key: pki.privateKeyToPem(keys.privateKey)
  };
}

export interface CertPair {
  key: string;
  cert: X509Certificate;
}

export interface CertificateOptions {
  validFrom?: Date;
  validTo?: Date;
  serialNumber?: string;
  commonName?: string;
}

function nextDay(from: Date) {
  const date = new Date(from.getTime());
  date.setDate(date.getDate() + 1);
  return date;
}
