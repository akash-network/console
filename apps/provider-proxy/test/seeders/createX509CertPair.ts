import { certificateManager } from "@akashnetwork/chain-sdk";
import { X509Certificate } from "node:crypto";

export async function createX509CertPair(options: CertificateOptions = {}): Promise<CertPair> {
  const cert = await certificateManager.generatePEM(options.commonName ?? "example.org", {
    serial: BigInt(`0x${options.serialNumber ?? "177831BE7F249E66"}`) as unknown as number,
    validFrom: options.validFrom ?? new Date(),
    validTo: options.validTo ?? nextDay(options.validFrom ?? new Date())
  });

  return {
    cert: new X509Certificate(cert.cert),
    key: cert.privateKey
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
