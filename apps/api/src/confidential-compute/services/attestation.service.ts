import { singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type {
  CpuReportVerdict,
  GpuReportVerdict,
  ReportStatus,
  ReportVerdict,
  VerifyAttestationRequest,
  VerifyAttestationResponse
} from "../http-schemas/attestation.schema";
import { AmdSnpService } from "./amd-snp/amd-snp.service";
import { IntelTdxService } from "./intel-tdx/intel-tdx.service";
import { NvidiaGpuService } from "./nvidia-gpu/nvidia-gpu.service";

/**
 * Orchestrates per-report attestation verification across the hardware vendors and isolates failures: the CPU
 * report routes to AMD SEV-SNP or Intel TDX by platform, and each GPU report routes to NVIDIA. Every verifier
 * runs independently — a thrown error (vendor service unreachable, etc.) becomes that report's `unverifiable`
 * verdict instead of failing the whole response (CON-552 acceptance criterion).
 */
@singleton()
export class AttestationService {
  constructor(
    private readonly amdSnpService: AmdSnpService,
    private readonly intelTdxService: IntelTdxService,
    private readonly nvidiaGpuService: NvidiaGpuService,
    private readonly logger: LoggerService
  ) {}

  async verify(request: VerifyAttestationRequest): Promise<VerifyAttestationResponse> {
    const cpuVendor: CpuReportVerdict["vendor"] = request.tee_platform.startsWith("snp") ? "amd-sev-snp" : "intel-tdx";

    const tasks: Array<Promise<ReportVerdict>> = [
      this.#safe(
        () =>
          cpuVendor === "amd-sev-snp"
            ? this.amdSnpService.verify({ report: request.report, certChain: request.cert_chain, nonce: request.nonce })
            : this.intelTdxService.verify({ report: request.report, nonce: request.nonce }),
        detail => ({ kind: "cpu", vendor: cpuVendor, status: "unverifiable", detail })
      )
    ];

    if (request.tee_platform.endsWith("-gpu")) {
      for (const gpu of request.gpu_reports) {
        tasks.push(
          this.#safe(
            () => this.nvidiaGpuService.verify({ deviceIndex: gpu.device_index, report: gpu.report, nonce: request.nonce }),
            (detail): GpuReportVerdict => ({ kind: "gpu", device_index: gpu.device_index, vendor: "nvidia", status: "unverifiable", detail })
          )
        );
      }
    }

    const reports = await Promise.all(tasks);
    return { overall: rollup(reports), nonce: request.nonce, reports };
  }

  /** Runs a verifier; any throw is logged and converted to the report's `unverifiable` verdict. */
  async #safe<T extends ReportVerdict>(verify: () => Promise<T>, toUnverifiable: (detail: string) => T): Promise<T> {
    try {
      return await verify();
    } catch (error) {
      this.logger.error({ event: "ATTESTATION_VERIFY_ERROR", error });
      const detail = error instanceof Error ? error.message : "verification could not be completed";
      return toUnverifiable(`Verification could not be completed: ${detail}`);
    }
  }
}

function rollup(reports: ReportVerdict[]): ReportStatus {
  if (reports.every(report => report.status === "valid")) return "valid";
  if (reports.some(report => report.status === "invalid")) return "invalid";
  return "unverifiable";
}
