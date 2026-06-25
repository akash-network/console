/**
 * Parser for the AMD SEV-SNP ATTESTATION_REPORT binary structure (no I/O; pure and fixture-tested).
 *
 * Field offsets follow the AMD SEV-SNP ABI and are validated against a real on-chain attestation report.
 * The report is signed with ECDSA P-384 over its first {@link SNP_SIGNED_LENGTH} bytes; the signature `r`/`s`
 * components are stored little-endian in fixed 72-byte fields and are converted here to big-endian so they can
 * be fed to `crypto.verify(..., { dsaEncoding: "ieee-p1363" })`.
 */

/** The report is at least this long (bytes before + including the signature block). */
export const SNP_REPORT_MIN_LENGTH = 0x4a0;
/** ECDSA signs everything before the signature block. */
export const SNP_SIGNED_LENGTH = 0x2a0;
/** P-384 component size in bytes. */
export const SNP_ECDSA_COMPONENT_BYTES = 48;
/** signature_algo value for ECDSA P-384 with SHA-384. */
export const SNP_SIG_ALGO_ECDSA_P384_SHA384 = 1;

const OFFSET = {
  version: 0x00,
  guestSvn: 0x04,
  policy: 0x08,
  signatureAlgo: 0x34,
  reportData: 0x50,
  measurement: 0x90,
  reportedTcb: 0x180,
  cpuidFamId: 0x188,
  cpuidModId: 0x189,
  cpuidStep: 0x18a,
  chipId: 0x1a0,
  signature: 0x2a0
} as const;

export interface ParsedSnpReport {
  version: number;
  guestSvn: number;
  policy: bigint;
  signatureAlgo: number;
  /** 64-byte field that must equal the tenant nonce (when not TLS-bound). */
  reportData: Buffer;
  /** 48-byte launch measurement (parsed, not compared — authenticity-only). */
  measurement: Buffer;
  reportedTcb: { bootloader: number; tee: number; snp: number; microcode: number; raw: Buffer };
  cpuid: { familyId: number; modelId: number; stepping: number };
  /** 64-byte unique chip id, hex-encoded for the AMD KDS VCEK lookup. */
  chipId: Buffer;
  /** The bytes the signature covers: report[0, SNP_SIGNED_LENGTH). */
  signedData: Buffer;
  /** ECDSA P-384 signature, components big-endian and left-padded to 48 bytes. */
  signature: { r: Buffer; s: Buffer };
}

export class SnpReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnpReportParseError";
  }
}

/** Little-endian component (low 48 bytes of the 72-byte field) → big-endian, padded to 48 bytes. */
function leComponentToBe(report: Buffer, offset: number): Buffer {
  return Buffer.from(report.subarray(offset, offset + SNP_ECDSA_COMPONENT_BYTES)).reverse();
}

export function parseSnpReport(report: Buffer): ParsedSnpReport {
  if (report.length < SNP_REPORT_MIN_LENGTH) {
    throw new SnpReportParseError(`SNP report too short: ${report.length} bytes (expected at least ${SNP_REPORT_MIN_LENGTH})`);
  }

  const reportedTcbRaw = Buffer.from(report.subarray(OFFSET.reportedTcb, OFFSET.reportedTcb + 8));

  return {
    version: report.readUInt32LE(OFFSET.version),
    guestSvn: report.readUInt32LE(OFFSET.guestSvn),
    policy: report.readBigUInt64LE(OFFSET.policy),
    signatureAlgo: report.readUInt32LE(OFFSET.signatureAlgo),
    reportData: Buffer.from(report.subarray(OFFSET.reportData, OFFSET.reportData + 64)),
    measurement: Buffer.from(report.subarray(OFFSET.measurement, OFFSET.measurement + 48)),
    reportedTcb: {
      bootloader: reportedTcbRaw[0],
      tee: reportedTcbRaw[1],
      snp: reportedTcbRaw[6],
      microcode: reportedTcbRaw[7],
      raw: reportedTcbRaw
    },
    cpuid: {
      familyId: report[OFFSET.cpuidFamId],
      modelId: report[OFFSET.cpuidModId],
      stepping: report[OFFSET.cpuidStep]
    },
    chipId: Buffer.from(report.subarray(OFFSET.chipId, OFFSET.chipId + 64)),
    signedData: Buffer.from(report.subarray(0, SNP_SIGNED_LENGTH)),
    signature: {
      r: leComponentToBe(report, OFFSET.signature),
      s: leComponentToBe(report, OFFSET.signature + 72)
    }
  };
}
