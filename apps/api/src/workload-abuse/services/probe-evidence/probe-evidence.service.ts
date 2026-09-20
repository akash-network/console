import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { parseProbeEvidence } from "@src/workload-abuse/lib/probe-evidence/parse-probe-evidence";
import {
  type WorkloadProbeEvidenceOutput,
  WorkloadProbeEvidenceRepository
} from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import type { ShellEvidence } from "@src/workload-abuse/services/trial-workload-probe/trial-workload-probe.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

@singleton()
export class ProbeEvidenceService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly evidenceRepository: WorkloadProbeEvidenceRepository,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProbeEvidenceService.name });
  }

  async recordEvidence(input: {
    walletId: number;
    dseq: string;
    verdict: string;
    detectionId?: string;
    shellEvidence: ShellEvidence[];
  }): Promise<WorkloadProbeEvidenceOutput[]> {
    if (!input.shellEvidence.length) return [];

    try {
      return await this.evidenceRepository.insertMany(
        input.shellEvidence.map(shellEvidence => {
          const features = parseProbeEvidence(shellEvidence.evidence);
          return {
            walletId: input.walletId,
            dseq: input.dseq,
            provider: shellEvidence.provider,
            service: shellEvidence.service,
            shellStatus: shellEvidence.status,
            verdict: input.verdict,
            detectionId: input.detectionId,
            accelerator: features.accelerator,
            artifacts: features.artifacts,
            processOrigins: features.processOrigins,
            netShape: features.netShape
          };
        })
      );
    } catch (error) {
      this.instrumentation.recordEvidenceWriteFailure("insert");
      this.logger.warn({ event: "WORKLOAD_EVIDENCE_WRITE_FAILED", error, walletId: input.walletId, dseq: input.dseq });
      return [];
    }
  }

  async purgeExpired(): Promise<void> {
    const retentionDays = this.config.get("WORKLOAD_ABUSE_EVIDENCE_RETENTION_DAYS");
    const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      await this.evidenceRepository.deleteOlderThan({ before });
    } catch (error) {
      this.instrumentation.recordEvidenceWriteFailure("purge");
      this.logger.warn({ event: "WORKLOAD_EVIDENCE_PURGE_FAILED", error, before });
    }
  }
}
