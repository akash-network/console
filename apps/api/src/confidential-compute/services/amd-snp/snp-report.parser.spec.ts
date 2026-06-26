import { describe, expect, it } from "vitest";

import { parseSnpReport, SNP_REPORT_MIN_LENGTH, SnpReportParseError } from "./snp-report.parser";

describe(parseSnpReport.name, () => {
  it("reads scalar fields from their ABI offsets", () => {
    const report = buildReport();

    const parsed = parseSnpReport(report);

    expect(parsed.version).toBe(2);
    expect(parsed.guestSvn).toBe(7);
    expect(parsed.policy).toBe(0x30000n);
    expect(parsed.signatureAlgo).toBe(1);
  });

  it("extracts the 64-byte report_data, 48-byte measurement and 64-byte chip_id", () => {
    const report = buildReport();

    const parsed = parseSnpReport(report);

    expect(parsed.reportData).toEqual(Buffer.alloc(64, 0xab));
    expect(parsed.measurement).toEqual(Buffer.alloc(48, 0xcd));
    expect(parsed.chipId).toEqual(Buffer.alloc(64, 0xee));
  });

  it("decomposes reported_tcb into bootloader/tee/snp/microcode", () => {
    const report = buildReport();

    const parsed = parseSnpReport(report);

    expect(parsed.reportedTcb.bootloader).toBe(0xfc);
    expect(parsed.reportedTcb.tee).toBe(0x28);
    expect(parsed.reportedTcb.snp).toBe(0x05);
    expect(parsed.reportedTcb.microcode).toBe(0x61);
  });

  it("reads the cpuid family/model/stepping bytes", () => {
    const report = buildReport();

    const parsed = parseSnpReport(report);

    expect(parsed.cpuid).toEqual({ familyId: 0x19, modelId: 0x11, stepping: 0x01 });
  });

  it("exposes the signed region as the report bytes before the signature block", () => {
    const report = buildReport();

    const parsed = parseSnpReport(report);

    expect(parsed.signedData).toHaveLength(0x2a0);
    expect(parsed.signedData).toEqual(report.subarray(0, 0x2a0));
  });

  it("converts the little-endian signature components to big-endian, padded to 48 bytes", () => {
    // r occupies the low 48 bytes of its 72-byte field, little-endian: [01,02,...,30].
    const rLe = Buffer.from(Array.from({ length: 48 }, (_, i) => i + 1));
    const report = buildReport({ rLe });

    const parsed = parseSnpReport(report);

    expect(parsed.signature.r).toHaveLength(48);
    expect(parsed.signature.r).toEqual(Buffer.from(rLe).reverse());
  });

  it("throws SnpReportParseError when the buffer is shorter than a full report", () => {
    expect(() => parseSnpReport(Buffer.alloc(SNP_REPORT_MIN_LENGTH - 1))).toThrow(SnpReportParseError);
  });

  function buildReport(input: { rLe?: Buffer } = {}) {
    const report = Buffer.alloc(SNP_REPORT_MIN_LENGTH);
    report.writeUInt32LE(2, 0x00); // version
    report.writeUInt32LE(7, 0x04); // guest_svn
    report.writeBigUInt64LE(0x30000n, 0x08); // policy
    report.writeUInt32LE(1, 0x34); // signature_algo
    Buffer.alloc(64, 0xab).copy(report, 0x50); // report_data
    Buffer.alloc(48, 0xcd).copy(report, 0x90); // measurement
    Buffer.from([0xfc, 0x28, 0, 0, 0, 0, 0x05, 0x61]).copy(report, 0x180); // reported_tcb
    report[0x188] = 0x19; // cpuid_fam_id
    report[0x189] = 0x11; // cpuid_mod_id
    report[0x18a] = 0x01; // cpuid_step
    Buffer.alloc(64, 0xee).copy(report, 0x1a0); // chip_id
    (input.rLe ?? Buffer.alloc(48, 0x07)).copy(report, 0x2a0); // signature r (little-endian)
    return report;
  }
});
