import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DEFAULT_GPU_REQUEST_ROUTING_POLICY } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { GpuRequestRoutingService } from "./gpu-request-routing.service";

import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

describe(GpuRequestRoutingService.name, () => {
  describe("getPolicy", () => {
    it("reads the policy from the routing flag's payload", () => {
      const { service, featureFlagsService } = setup({ payload: JSON.stringify({ salesRules: { monthlyValue: { minUsd: 100 } } }) });

      expect(service.getPolicy().salesRules.monthlyValue.minUsd).toBe(100);
      expect(featureFlagsService.getVariantPayload).toHaveBeenCalledWith(FeatureFlags.GPU_REQUEST_ROUTING);
    });

    it("falls back to the coded defaults without a payload", () => {
      const { service, logger } = setup({ payload: undefined });

      expect(service.getPolicy()).toBe(DEFAULT_GPU_REQUEST_ROUTING_POLICY);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
      { case: "is not JSON", payload: "{not json" },
      { case: "breaks the schema", payload: JSON.stringify({ salesRules: { monthlyValue: { minUsd: "lots" } } }) }
    ])("falls back to the coded defaults and warns when the payload $case", ({ payload }) => {
      const { service, logger } = setup({ payload });

      expect(service.getPolicy()).toBe(DEFAULT_GPU_REQUEST_ROUTING_POLICY);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_REQUEST_ROUTING_PAYLOAD_INVALID" }));
    });
  });

  describe("route", () => {
    it.each([
      { accountType: "paying", lane: "sales" },
      { accountType: "trial", lane: "automated" },
      { accountType: "no_card", lane: "automated" }
    ] as const)("lets a $accountType account's large request reach the $lane lane", async ({ accountType, lane }) => {
      const { service, hardwareRequestAccountService } = setup({ payload: undefined });
      hardwareRequestAccountService.findAccountType.mockResolvedValue(accountType);
      const requester = { userId: "user-1", organizationId: "org-1" };

      const routing = await service.route({ spec: createHardwareRequestSpec({ wantsToTalk: true }), gpuModel: null, quantity: null }, requester);

      expect(routing.lane).toBe(lane);
      expect(hardwareRequestAccountService.findAccountType).toHaveBeenCalledWith(requester);
    });

    it("gives a sales-lane request the owner the policy picks for it", async () => {
      const payload = JSON.stringify({ owners: [{ name: "Remington", match: { gpuClass: "data_center" } }] });
      const { service, hardwareRequestAccountService } = setup({ payload });
      hardwareRequestAccountService.findAccountType.mockResolvedValue("paying");

      const routing = await service.route({ spec: createHardwareRequestSpec(), gpuModel: null, quantity: null }, { userId: "user-1", organizationId: null });

      expect(routing).toMatchObject({ lane: "sales", owner: "Remington" });
    });

    it("leaves an automated-lane request without an owner", async () => {
      const { service, hardwareRequestAccountService } = setup({ payload: undefined });
      hardwareRequestAccountService.findAccountType.mockResolvedValue("trial");

      const routing = await service.route({ spec: createHardwareRequestSpec(), gpuModel: null, quantity: null }, { userId: "user-1", organizationId: null });

      expect(routing).toMatchObject({ lane: "automated", owner: null });
    });

    it("routes with the policy of the flag's payload", async () => {
      const { service, hardwareRequestAccountService } = setup({ payload: JSON.stringify({ salesRequiresPaymentMethod: false }) });
      hardwareRequestAccountService.findAccountType.mockResolvedValue("trial");

      const routing = await service.route(
        { spec: createHardwareRequestSpec({ wantsToTalk: true }), gpuModel: null, quantity: null },
        { userId: "user-1", organizationId: null }
      );

      expect(routing.lane).toBe("sales");
    });
  });

  function setup(input: { payload: string | undefined }) {
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.getVariantPayload.mockReturnValue(input.payload);
    const hardwareRequestAccountService = mock<HardwareRequestAccountService>();
    const logger = mock<LoggerService>();
    const service = new GpuRequestRoutingService(featureFlagsService, hardwareRequestAccountService, () => logger);

    return { service, featureFlagsService, hardwareRequestAccountService, logger };
  }
});
