import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { HealthzService, ProbeType, SummarizedProbeResult } from "@src/common/types/healthz.type";

const PROBE_METHOD_MAP: Record<ProbeType, keyof Omit<HealthzService, "name">> = {
  readiness: "getReadinessStatus",
  liveness: "getLivenessStatus"
};

@Injectable()
export class HealthzHelperService {
  async summarize(type: ProbeType, services: HealthzService[]) {
    const method = PROBE_METHOD_MAP[type];

    const statuses = await Promise.all(services.map(async service => ({ name: service.name, result: await service[method]() })));

    return statuses.reduce(
      (acc, status) => {
        if (status.result.status === "error") {
          acc.status = "error";
        }

        acc.data[status.name] = status.result.data;

        return acc;
      },
      {
        status: "ok",
        data: {}
      } as SummarizedProbeResult
    );
  }

  async throwUnlessHealthy(type: ProbeType, ...services: HealthzService[]) {
    const result = await this.summarize(type, services);

    if (result.status === "error") {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
