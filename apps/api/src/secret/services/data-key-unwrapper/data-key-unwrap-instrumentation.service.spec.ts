import type { Histogram, Meter } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DataKeyUnwrapInstrumentationService } from "./data-key-unwrap-instrumentation.service";

const USER_A = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";
const USER_B = "6d0b1f4c-2222-4444-8888-1a2b3c4d5e6f";

describe(DataKeyUnwrapInstrumentationService.name, () => {
  it("measures unwraps per request under a name a dashboard can chart", () => {
    const { metricsService, meter } = setup();

    expect(metricsService.getMeter).toHaveBeenCalledWith("data-key-unwrap");
    expect(metricsService.createHistogram).toHaveBeenCalledWith(meter, "user_data_key_unwraps_per_request", expect.anything());
  });

  it("documents the metric, so an operator meets it with its meaning attached", () => {
    const { metricsService, meter } = setup();

    expect(metricsService.createHistogram).toHaveBeenCalledWith(
      meter,
      expect.any(String),
      expect.objectContaining({ description: expect.stringMatching(/\S/) })
    );
  });

  it("ends a request that touched no data key without reporting a failure", async () => {
    const { inRequest, logger } = setup();

    await inRequest(async () => undefined);

    expect(logger.error).not.toHaveBeenCalled();
  });

  it("measures nothing for a request that touched no data key", async () => {
    const { inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => undefined);

    expect(unwrapsPerRequest.record).not.toHaveBeenCalled();
  });

  it("measures zero for a user whose key was held but never unwrapped", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => service.beginCountingUnwraps(USER_A));

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("measures one observation per user touched rather than one per request", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      service.beginCountingUnwraps(USER_A);
      service.countUnwrap(USER_A);
      service.beginCountingUnwraps(USER_B);
      service.countUnwrap(USER_B);
    });

    expect(unwrapsPerRequest.record.mock.calls).toEqual([[1], [1]]);
  });

  it("measures the unwraps a user cost, so a second unwrap of the same key is visible", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      service.beginCountingUnwraps(USER_A);
      service.countUnwrap(USER_A);
      service.countUnwrap(USER_A);
    });

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("counts a user it was never told about, so an uncounted hold cannot hide an unwrap", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => service.countUnwrap(USER_A));

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("carries no identifier on the measurement, so the time series stay bounded", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      service.beginCountingUnwraps(USER_A);
      service.countUnwrap(USER_A);
    });

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(expect.anything());
  });

  it("keeps the counts of two concurrent requests apart", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await Promise.all([
      inRequest(async () => {
        service.beginCountingUnwraps(USER_A);
        service.countUnwrap(USER_A);
      }),
      inRequest(async () => {
        service.beginCountingUnwraps(USER_B);
        service.countUnwrap(USER_B);
      })
    ]);

    expect(unwrapsPerRequest.record.mock.calls).toEqual([[1], [1]]);
  });

  it("forgets the counts of the request that ended", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      service.beginCountingUnwraps(USER_A);
      service.countUnwrap(USER_A);
    });
    await inRequest(async () => service.beginCountingUnwraps(USER_A));

    expect(unwrapsPerRequest.record.mock.calls).toEqual([[1], [0]]);
  });

  it("counts nothing outside a request rather than refusing the unwrap it measures", async () => {
    const { service, unwrapsPerRequest } = setup();

    service.beginCountingUnwraps(USER_A);
    service.countUnwrap(USER_A);

    expect(unwrapsPerRequest.record).not.toHaveBeenCalled();
  });

  function setup() {
    const meter = mock<Meter>();
    const unwrapsPerRequest = mock<Histogram>();

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(meter);
    metricsService.createHistogram.mockReturnValue(unwrapsPerRequest);

    const logger = mock<ReturnType<CreateLogger>>();
    const executionContextService = new ExecutionContextService(() => logger);
    const service = new DataKeyUnwrapInstrumentationService(metricsService, executionContextService);

    const inRequest = <R>(cb: () => Promise<R>) => executionContextService.runWithContext(cb);

    return { service, metricsService, meter, unwrapsPerRequest, executionContextService, logger, inRequest };
  }
});
