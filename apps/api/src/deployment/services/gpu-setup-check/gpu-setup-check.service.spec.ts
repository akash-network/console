import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { GpuSetupCheckRunRepository } from "@src/deployment/repositories/gpu-setup-check-run/gpu-setup-check-run.repository";
import type { GpuCheckRunner, GpuCheckRunResult, GpuCheckSession } from "@src/deployment/services/gpu-check-runner/gpu-check-runner.service";
import type { DayRepository } from "@src/gpu/repositories/day.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { type GpuSetup, GpuSetupCheckService } from "./gpu-setup-check.service";

describe(GpuSetupCheckService.name, () => {
  it("deploys every setup as one placement group of a single deployment", async () => {
    const { service, gpuCheckRunner } = setup();

    await service.check([aSetup({ model: "h100", count: 8, memory: "80Gi", interface: "sxm" }), aSetup({ model: "a100", count: 1 })]);

    expect(gpuCheckRunner.run).toHaveBeenCalledTimes(1);
    const [, deployments] = gpuCheckRunner.run.mock.calls[0];
    expect(deployments).toHaveLength(1);
    const gpus = deployments[0].manifest.groupSpecs.map(group => group.resources[0].resource!.gpu!);
    expect(gpus.map(gpu => [gpu.units?.val, gpu.attributes.map(attribute => attribute.key)])).toEqual([
      [expect.anything(), ["vendor/nvidia/model/h100/ram/80Gi/interface/sxm"]],
      [expect.anything(), ["vendor/nvidia/model/a100"]]
    ]);
    expect(deployments[0].manifest.groupModels).toEqual(["h100", "a100"]);
  });

  it("reports each setup's bidders with an hourly usd price", async () => {
    const setups = [aSetup({ model: "h100" }), aSetup({ model: "a100" })];
    const { service } = setup({
      bids: [
        aBid({ gseq: 1, provider: "akash1a", denom: "uact", amount: "1000" }),
        aBid({ gseq: 1, provider: "akash1b", denom: "uact", amount: "500" }),
        aBid({ gseq: 2, provider: "akash1a", denom: "uakt", amount: "1000" }),
        aBid({ gseq: 2, provider: "akash1c", denom: "ibc/unknown", amount: "1" })
      ],
      aktPrice: 2
    });

    const outcome = await service.check(setups);

    expect(outcome).toEqual({
      status: "checked",
      results: [
        {
          setup: setups[0],
          status: "checked",
          bids: [
            { provider: "akash1b", priceUsdPerHour: hourlyUsd(500) },
            { provider: "akash1a", priceUsdPerHour: hourlyUsd(1000) }
          ]
        },
        { setup: setups[1], status: "checked", bids: [{ provider: "akash1a", priceUsdPerHour: hourlyUsd(1000 * 2) }] }
      ]
    });
  });

  it("drops a uakt bid when no akt price is known", async () => {
    const { service } = setup({ bids: [aBid({ gseq: 1, provider: "akash1a", denom: "uakt", amount: "1000" })], aktPrice: null });

    const outcome = await service.check([aSetup()]);

    expect(outcome).toEqual({ status: "checked", results: [{ setup: expect.anything(), status: "checked", bids: [] }] });
  });

  it("refuses to deploy once the daily cap is reached", async () => {
    const { service, gpuCheckRunner, gpuSetupCheckRunRepository } = setup({ runsToday: 100, dailyCap: 100 });

    const outcome = await service.check([aSetup()]);

    expect(outcome).toEqual({ status: "cap_reached" });
    expect(gpuCheckRunner.run).not.toHaveBeenCalled();
    expect(gpuSetupCheckRunRepository.insert).not.toHaveBeenCalled();
  });

  it("counts runs since UTC midnight", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T15:30:00Z") });
    try {
      const { service, gpuSetupCheckRunRepository } = setup();

      await service.check([aSetup()]);

      expect(gpuSetupCheckRunRepository.countCreatedSince).toHaveBeenCalledWith(new Date("2026-11-18T00:00:00Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports unavailable when the bot wallet is not configured", async () => {
    const { service, gpuCheckRunner } = setup({ connected: false });

    const outcome = await service.check([aSetup()]);

    expect(outcome).toEqual({ status: "unavailable" });
    expect(gpuCheckRunner.run).not.toHaveBeenCalled();
  });

  it("records the run against the cap", async () => {
    const { service, gpuSetupCheckRunRepository } = setup({ dseq: "123" });

    await service.check([aSetup(), aSetup()]);

    expect(gpuSetupCheckRunRepository.insert).toHaveBeenCalledWith({ dseq: "123", setupCount: 2 });
  });

  it("still counts a run against the cap when it fails after creating its deployment", async () => {
    const { service, gpuSetupCheckRunRepository, gpuBidCheckRepository } = setup({ dseq: "123", runError: new Error("bids unreadable") });

    await expect(service.check([aSetup()])).rejects.toThrow("bids unreadable");

    expect(gpuSetupCheckRunRepository.insert).toHaveBeenCalledWith({ dseq: "123", setupCount: 1 });
    expect(gpuBidCheckRepository.insertMany).not.toHaveBeenCalled();
  });

  it("records bids as setup-check evidence", async () => {
    const { service, gpuBidCheckRepository } = setup({
      dseq: "123",
      bids: [aBid({ gseq: 1, provider: "akash1bidder" })],
      screenedByGroup: [["akash1bidder", "akash1silent"]]
    });

    await service.check([aSetup({ model: "h100" })]);

    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ provider: "akash1bidder", vendor: "nvidia", model: "h100", source: "setup-check", dseq: "123", screened: true, bid: true }),
      expect.objectContaining({ provider: "akash1silent", source: "setup-check", screened: true, bid: false })
    ]);
  });

  it("leaves an invalid setup out of the deployment and checks the others", async () => {
    const setups = [aSetup({ model: "h100" }), aSetup({ model: "a100", interface: "nvlink" }), aSetup({ model: "l40s" })];
    const { service, gpuCheckRunner, gpuSetupCheckRunRepository, gpuBidCheckRepository, logger } = setup({
      dseq: "123",
      bids: [aBid({ gseq: 1, provider: "akash1a", amount: "1000" }), aBid({ gseq: 2, provider: "akash1b", amount: "2000" })]
    });

    const outcome = await service.check(setups);

    const [, deployments] = gpuCheckRunner.run.mock.calls[0];
    expect(deployments[0].manifest.groupModels).toEqual(["h100", "l40s"]);
    expect(outcome).toEqual({
      status: "checked",
      results: [
        { setup: setups[0], status: "checked", bids: [{ provider: "akash1a", priceUsdPerHour: hourlyUsd(1000) }] },
        { setup: setups[1], status: "invalid", bids: [] },
        { setup: setups[2], status: "checked", bids: [{ provider: "akash1b", priceUsdPerHour: hourlyUsd(2000) }] }
      ]
    });
    expect(gpuSetupCheckRunRepository.insert).toHaveBeenCalledWith({ dseq: "123", setupCount: 2 });
    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ provider: "akash1a", model: "h100" }),
      expect.objectContaining({ provider: "akash1b", model: "l40s" })
    ]);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_SETUP_CHECK_SETUP_INVALID", setup: setups[1] }));
  });

  it.each([
    { field: "model", setup: { model: "h100 sxm" } },
    { field: "memory", setup: { memory: "80 Gi" } }
  ])("treats a setup whose $field an SDL attribute cannot carry as invalid", async ({ setup: invalid }) => {
    const { service, gpuCheckRunner } = setup();

    const outcome = await service.check([aSetup(invalid), aSetup({ model: "a100" })]);

    expect(gpuCheckRunner.run.mock.calls[0][1][0].manifest.groupModels).toEqual(["a100"]);
    expect(outcome).toMatchObject({ status: "checked", results: [{ status: "invalid" }, { status: "checked" }] });
  });

  it("deploys nothing and spends nothing from the cap when every setup is invalid", async () => {
    const setups = [aSetup({ model: "h100", interface: "nvlink" })];
    const { service, gpuCheckRunner, gpuSetupCheckRunRepository } = setup();

    const outcome = await service.check(setups);

    expect(outcome).toEqual({ status: "checked", results: [{ setup: setups[0], status: "invalid", bids: [] }] });
    expect(gpuCheckRunner.connect).not.toHaveBeenCalled();
    expect(gpuSetupCheckRunRepository.countCreatedSince).not.toHaveBeenCalled();
  });

  it("checks nothing when given no setups", async () => {
    const { service, gpuCheckRunner } = setup();

    expect(await service.check([])).toEqual({ status: "checked", results: [] });
    expect(gpuCheckRunner.connect).not.toHaveBeenCalled();
  });

  it("rejects more than 20 setups", async () => {
    const { service, gpuCheckRunner } = setup();

    await expect(service.check(Array.from({ length: 21 }, () => aSetup()))).rejects.toThrow("At most 20");
    expect(gpuCheckRunner.run).not.toHaveBeenCalled();
  });

  function hourlyUsd(amountPerBlockInUsdMicro: number) {
    return Math.round(((averageBlockCountInAnHour * amountPerBlockInUsdMicro) / 1_000_000) * 100) / 100;
  }

  function aSetup(overrides: Partial<GpuSetup> = {}): GpuSetup {
    return { vendor: "nvidia", model: "h100", count: 1, ...overrides };
  }

  function aBid(input: { gseq: number; provider: string; denom?: string; amount?: string }) {
    return mock<Bid>({
      id: { gseq: input.gseq, provider: input.provider },
      price: { denom: input.denom ?? "uact", amount: input.amount ?? "1000" }
    });
  }

  function setup(
    input: {
      bids?: Bid[];
      aktPrice?: number | null;
      runsToday?: number;
      dailyCap?: number;
      connected?: boolean;
      dseq?: string;
      screenedByGroup?: string[][] | null;
      runError?: Error;
    } = {}
  ) {
    const gpuCheckRunner = mock<GpuCheckRunner>();
    gpuCheckRunner.connect.mockResolvedValue(input.connected === false ? null : mock<GpuCheckSession>());
    const dseq = input.dseq ?? "1";
    gpuCheckRunner.run.mockImplementation(async (_session, _deployments, options) => {
      await options?.onCreated?.([dseq]);
      if (input.runError) throw input.runError;
      return [{ dseq, bids: input.bids ?? [], screenedByGroup: input.screenedByGroup ?? null } satisfies GpuCheckRunResult];
    });

    const gpuSetupCheckRunRepository = mock<GpuSetupCheckRunRepository>();
    gpuSetupCheckRunRepository.countCreatedSince.mockResolvedValue(input.runsToday ?? 0);
    const gpuBidCheckRepository = mock<GpuBidCheckRepository>();
    const dayRepository = mock<DayRepository>();
    dayRepository.getLatestAktPrice.mockResolvedValue("aktPrice" in input ? input.aktPrice! : 1);
    const deploymentConfig = mock<DeploymentConfig>({ GPU_SETUP_CHECK_DAILY_CAP: input.dailyCap ?? 100 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new GpuSetupCheckService(gpuCheckRunner, gpuSetupCheckRunRepository, gpuBidCheckRepository, dayRepository, deploymentConfig, createLogger);

    return { service, gpuCheckRunner, gpuSetupCheckRunRepository, gpuBidCheckRepository, dayRepository, logger };
  }
});
