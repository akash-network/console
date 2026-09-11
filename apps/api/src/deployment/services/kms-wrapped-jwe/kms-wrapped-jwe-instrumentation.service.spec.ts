import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import { KmsWrappedJweInstrumentationService } from "./kms-wrapped-jwe-instrumentation.service";

const KEY_SERVICE_FAILURES = [
  "KEY_SERVICE_UNREACHABLE",
  "ENCRYPTED_KEY_REJECTED",
  "KEY_SERVICE_REQUEST_CORRUPTED",
  "KEY_SERVICE_PLAINTEXT_MISSING",
  "KEY_SERVICE_RESPONSE_CORRUPTED"
] as const;

describe(KmsWrappedJweInstrumentationService.name, () => {
  it("measures latency and call outcomes under names a dashboard can separate from database latency", () => {
    const { meter, metricsService } = setup();

    expect(metricsService.createHistogram).toHaveBeenCalledWith(meter, "kms_key_service_call_duration_ms", expect.objectContaining({ unit: "ms" }));
    expect(metricsService.createCounter).toHaveBeenCalledWith(meter, "kms_key_service_calls_total", expect.anything());
  });

  describe("recordCallSucceeded", () => {
    it("records the key service call duration as a success", () => {
      const { service, callDuration } = setup();

      service.recordCallSucceeded(42);

      expect(callDuration.record).toHaveBeenCalledExactlyOnceWith(42, { status: "success" });
    });

    it("counts nothing, because a healthy call can still hand back an unusable response", () => {
      const { service, calls } = setup();

      service.recordCallSucceeded(42);

      expect(calls.add).not.toHaveBeenCalled();
    });
  });

  describe("recordCallFailed", () => {
    it("records the key service call duration as a failure", () => {
      const { service, callDuration } = setup();

      service.recordCallFailed(17);

      expect(callDuration.record).toHaveBeenCalledExactlyOnceWith(17, { status: "failure" });
    });
  });

  describe("recordUnwrapSucceeded", () => {
    it("counts an unwrap the key service served", () => {
      const { service, calls } = setup();

      service.recordUnwrapSucceeded();

      expect(calls.add).toHaveBeenCalledExactlyOnceWith(1, { status: "success" });
    });
  });

  describe("recordUnwrapFailed", () => {
    it.each(KEY_SERVICE_FAILURES)("counts a %s unwrap under the failure that caused it", failure => {
      const { service, calls } = setup();

      service.recordUnwrapFailed(failure);

      expect(calls.add).toHaveBeenCalledExactlyOnceWith(1, { status: "failure", failure });
    });

    it("records no call duration, because the call it followed was already timed where it happened", () => {
      const { service, callDuration } = setup();

      service.recordUnwrapFailed("KEY_SERVICE_UNREACHABLE");

      expect(callDuration.record).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const meter = mock<Meter>();
    const callDuration = mock<Histogram>();
    const calls = mock<Counter>();

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(meter);
    metricsService.createHistogram.mockReturnValue(callDuration);
    metricsService.createCounter.mockReturnValue(calls);

    const service = new KmsWrappedJweInstrumentationService(metricsService);

    return { service, metricsService, meter, callDuration, calls };
  }
});
