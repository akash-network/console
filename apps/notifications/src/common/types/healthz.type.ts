export type HealthzStatus = "ok" | "error";

type ProbeResultData = Record<string, boolean>;

export type ProbeResult = {
  status: HealthzStatus;
  data: ProbeResultData;
};

export type SummarizedProbeResult = {
  status: HealthzStatus;
  data: Record<string, ProbeResultData>;
};

export type ProbeType = "readiness" | "liveness";

type ProbeResultCheck = () => Promise<ProbeResult>;

export interface HealthzService {
  readonly name: string;
  getReadinessStatus: ProbeResultCheck;
  getLivenessStatus: ProbeResultCheck;
}
