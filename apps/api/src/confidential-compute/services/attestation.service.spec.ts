import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CpuReportVerdict, GpuReportVerdict, VerifyAttestationRequest } from "../http-schemas/attestation.schema";
import type { AmdSnpService } from "./amd-snp/amd-snp.service";
import type { IntelTdxService } from "./intel-tdx/intel-tdx.service";
import type { NvidiaGpuService } from "./nvidia-gpu/nvidia-gpu.service";
import { AttestationService } from "./attestation.service";

const cpu = (status: CpuReportVerdict["status"], vendor: CpuReportVerdict["vendor"] = "amd-sev-snp"): CpuReportVerdict => ({
  kind: "cpu",
  vendor,
  status,
  detail: "test"
});
const gpu = (deviceIndex: number, status: GpuReportVerdict["status"]): GpuReportVerdict => ({
  kind: "gpu",
  device_index: deviceIndex,
  vendor: "nvidia",
  status,
  detail: "test"
});

describe(AttestationService.name, () => {
  it("routes the CPU report to AMD and each GPU report to NVIDIA for an snp-gpu platform", async () => {
    const { service, amdSnpService, intelTdxService, nvidiaGpuService } = setup();
    amdSnpService.verify.mockResolvedValue(cpu("valid"));
    nvidiaGpuService.verify.mockResolvedValue(gpu(0, "valid"));

    const result = await service.verify(request({ tee_platform: "snp-gpu", gpu_reports: [{ device_index: 0, report: "g0" }] }));

    expect(amdSnpService.verify).toHaveBeenCalledOnce();
    expect(intelTdxService.verify).not.toHaveBeenCalled();
    expect(nvidiaGpuService.verify).toHaveBeenCalledWith(expect.objectContaining({ deviceIndex: 0, report: "g0" }));
    expect(result.reports).toEqual([cpu("valid"), gpu(0, "valid")]);
    expect(result.overall).toBe("valid");
  });

  it("routes the CPU report to Intel for a tdx platform and does not verify GPUs", async () => {
    const { service, intelTdxService, nvidiaGpuService } = setup();
    intelTdxService.verify.mockResolvedValue(cpu("valid", "intel-tdx"));

    const result = await service.verify(request({ tee_platform: "tdx", gpu_reports: [{ device_index: 0, report: "g0" }] }));

    expect(intelTdxService.verify).toHaveBeenCalledOnce();
    expect(nvidiaGpuService.verify).not.toHaveBeenCalled();
    expect(result.reports).toEqual([cpu("valid", "intel-tdx")]);
  });

  it("isolates a failing vendor: a thrown GPU error becomes that report's unverifiable verdict while the CPU verdict stands", async () => {
    const { service, amdSnpService, nvidiaGpuService, logger } = setup();
    amdSnpService.verify.mockResolvedValue(cpu("valid"));
    nvidiaGpuService.verify.mockRejectedValue(new Error("NRAS unreachable"));

    const result = await service.verify(request({ tee_platform: "snp-gpu", gpu_reports: [{ device_index: 0, report: "g0" }] }));

    expect(result.reports[0]).toEqual(cpu("valid"));
    expect(result.reports[1]).toMatchObject({ kind: "gpu", device_index: 0, status: "unverifiable" });
    // The raw upstream error is logged but kept out of the client-facing detail.
    expect(result.reports[1].detail).not.toMatch(/NRAS unreachable/);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "ATTESTATION_VERIFY_ERROR" }));
    expect(result.overall).toBe("unverifiable");
  });

  it("rolls up to invalid when any report is invalid", async () => {
    const { service, amdSnpService, nvidiaGpuService } = setup();
    amdSnpService.verify.mockResolvedValue(cpu("valid"));
    nvidiaGpuService.verify.mockResolvedValue(gpu(0, "invalid"));

    const result = await service.verify(request({ tee_platform: "snp-gpu", gpu_reports: [{ device_index: 0, report: "g0" }] }));

    expect(result.overall).toBe("invalid");
  });

  it("echoes the request nonce in the response", async () => {
    const { service, amdSnpService } = setup();
    amdSnpService.verify.mockResolvedValue(cpu("valid"));

    const result = await service.verify(request({ tee_platform: "snp", nonce: "the-nonce" }));

    expect(result.nonce).toBe("the-nonce");
  });

  function setup() {
    const amdSnpService = mock<AmdSnpService>();
    const intelTdxService = mock<IntelTdxService>();
    const nvidiaGpuService = mock<NvidiaGpuService>();
    const logger = mock<LoggerService>();
    const service = new AttestationService(amdSnpService, intelTdxService, nvidiaGpuService, logger);
    return { service, amdSnpService, intelTdxService, nvidiaGpuService, logger };
  }
});

function request(overrides: Partial<VerifyAttestationRequest>): VerifyAttestationRequest {
  return { nonce: "nonce", report: "cpu-report", tee_platform: "snp", cert_chain: "", auxblob: "", gpu_reports: [], ...overrides };
}
