import type { AnyAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { addWeeks } from "date-fns";
import { millisecondsInHour, minutesInHour } from "date-fns/constants";
import { groupBy } from "lodash";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import type { DeploymentCloseJobService } from "../deployment-close-job/deployment-close-job.service";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DrainingDeploymentRpcService } from "../draining-deployment-rpc/draining-deployment-rpc.service";
import type { DeploymentTopUpInstrumentation } from "../top-up-managed-deployments/deployment-top-up-instrumentation";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders";
import { createAutoTopUpDeployment, createManyAutoTopUpDeployments } from "@test/seeders/auto-top-up-deployment.seeder";
import { createDrainingDeployment } from "@test/seeders/draining-deployment.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DrainingDeploymentService.name, () => {
  describe("findDrainingDeploymentsByOwner", () => {
    it("paginates draining deployments by owner and marks closed ones as such", async () => {
      const { service, deploymentSettingRepository, leaseRepository, loggerService, currentHeight } = setup();
      const deploymentSettings = createManyAutoTopUpDeployments(4);
      const addresses = deploymentSettings.map(s => s.address);
      const dseqs = deploymentSettings.map(s => Number(s.dseq));

      const activeBatches: DrainingDeploymentOutput[][] = [
        [
          {
            dseq: dseqs[0],
            owner: addresses[0],
            denom: "uakt",
            blockRate: faker.number.int({ min: 50, max: 100 }),
            predictedClosedHeight: faker.number.int({ min: 900000, max: 1000000 })
          }
        ],
        [
          {
            dseq: dseqs[3],
            owner: addresses[3],
            denom: "uakt",
            blockRate: faker.number.int({ min: 50, max: 100 }),
            predictedClosedHeight: faker.number.int({ min: 900000, max: 1000000 })
          }
        ]
      ];

      const closedBatch: DrainingDeploymentOutput[] = [
        {
          dseq: dseqs[1],
          owner: addresses[1],
          denom: "uakt",
          blockRate: faker.number.int({ min: 50, max: 100 }),
          predictedClosedHeight: currentHeight + 1000,
          closedHeight: currentHeight - 100
        }
      ];

      vi.spyOn(service, "findLeases")
        .mockResolvedValueOnce(activeBatches[0])
        .mockResolvedValueOnce(closedBatch)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activeBatches[1]);

      const deploymentSettingsByAddress = groupBy(deploymentSettings, "address");
      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          for (const [address, settings] of Object.entries(deploymentSettingsByAddress)) {
            yield { address, walletId: settings[0].walletId, deploymentSettings: settings };
          }
        })()
      );

      const callback = vi.fn();
      for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, mock<DeploymentTopUpInstrumentation>())) {
        callback(result);
      }

      expect(leaseRepository.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(loggerService.error).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));

      expect(callback).toHaveBeenCalledTimes(deploymentSettings.length);
      [activeBatches[0][0], activeBatches[1][0]].forEach(deployment => {
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            address: deployment.owner,
            drainingDeployments: expect.arrayContaining([
              expect.objectContaining({
                dseq: deployment.dseq.toString(),
                address: deployment.owner
              })
            ])
          })
        );
      });
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ address: addresses[1], activeDeployments: [], drainingDeployments: [] }));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ address: addresses[2], activeDeployments: [], drainingDeployments: [] }));
    });

    it("yields a non-draining owner with its active deployments and an empty fundable subset", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const creditsLowNotifiedAt = faker.date.recent();
      const setting = createAutoTopUpDeployment({ isWalletAutoTopUpEnabled: true, walletIsTrialing: true, walletCreditsLowNotifiedAt: creditsLowNotifiedAt });
      const farFromClosure = createDrainingDeployment({
        dseq: Number(setting.dseq),
        owner: setting.address,
        predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 24 * 7
      });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address: setting.address, walletId: setting.walletId, deploymentSettings: [setting] };
        })()
      );
      const findLeasesSpy = vi.spyOn(service, "findLeases").mockResolvedValue([farFromClosure]);

      const callback = vi.fn();
      for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, mock<DeploymentTopUpInstrumentation>())) {
        callback(result);
      }

      expect(findLeasesSpy).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER, setting.address, [setting.dseq]);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        address: setting.address,
        walletId: setting.walletId,
        userId: setting.userId,
        autoReloadEnabled: true,
        isTrialing: true,
        creditsLowNotifiedAt,
        activeDeployments: [expect.objectContaining({ dseq: setting.dseq, predictedClosedHeight: farFromClosure.predictedClosedHeight })],
        drainingDeployments: []
      });
    });

    it("reports marked-closed deployments to the caller's instrumentation", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const closedSetting = createAutoTopUpDeployment({ address, dseq: "4001" });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address, walletId: closedSetting.walletId, deploymentSettings: [closedSetting] };
        })()
      );
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({
          dseq: Number(closedSetting.dseq),
          owner: address,
          predictedClosedHeight: currentHeight + 500,
          closedHeight: currentHeight - 100
        })
      ]);

      const callback = vi.fn();
      for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, sink)) {
        callback(result);
      }

      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closedSetting.id]);
      expect(sink.recordDeploymentsMarkedClosed).toHaveBeenCalledWith(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ address, drainingDeployments: [] }));
    });

    it("marks no deployment closed during a dry run", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const closedSetting = createAutoTopUpDeployment({ address, dseq: "4002" });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address, walletId: closedSetting.walletId, deploymentSettings: [closedSetting] };
        })()
      );
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({
          dseq: Number(closedSetting.dseq),
          owner: address,
          predictedClosedHeight: currentHeight + 500,
          closedHeight: currentHeight - 100
        })
      ]);

      const callback = vi.fn();
      for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, sink, { dryRun: true })) {
        callback(result);
      }

      expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
      expect(sink.recordDeploymentsMarkedClosed).not.toHaveBeenCalled();
    });

    it("does not persist a runtime countdown during a dry run and still returns a calculated deadline", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, deploymentSettingRepository, currentHeight } = setup();
        const address = createAkashAddress();
        const runtimeLimitHours = 12;
        const setting = createAutoTopUpDeployment({ address, dseq: "3005", runtimeLimitHours, runtimeEndsAt: null });

        deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
          (async function* () {
            yield { address, walletId: setting.walletId, deploymentSettings: [setting] };
          })()
        );
        vi.spyOn(service, "findLeases").mockResolvedValue([
          createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
        ]);

        const callback = vi.fn();
        for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, mock<DeploymentTopUpInstrumentation>(), { dryRun: true })) {
          callback(result);
        }

        expect(deploymentSettingRepository.startRuntimeCountdown).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            address,
            drainingDeployments: [
              expect.objectContaining({
                dseq: setting.dseq,
                runtimeEndsAt: new Date(Date.now() + runtimeLimitHours * millisecondsInHour)
              })
            ]
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("findDrainingDeploymentsForOwner", () => {
    it("returns the owner's active draining deployments enriched with block rate and predicted close height", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const address = createAkashAddress();
      const settings = [createAutoTopUpDeployment({ address, dseq: "1001" }), createAutoTopUpDeployment({ address, dseq: "1002" })];
      const leases = settings.map(setting =>
        createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, blockRate: 60, predictedClosedHeight: 1000500 })
      );

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(settings);
      vi.spyOn(service, "findLeases").mockResolvedValue(leases);

      const result = await service.findDrainingDeploymentsForOwner(address, mock<DeploymentTopUpInstrumentation>(), currentHeight);

      expect(deploymentSettingRepository.findAutoTopUpDeploymentsByOwner).toHaveBeenCalledWith(address);
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining(settings.map(setting => expect.objectContaining({ dseq: setting.dseq, address, blockRate: 60, predictedClosedHeight: 1000500 })))
      );
    });

    it("marks a deployment whose escrow account is no longer open even though its lease still reads open", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const activeSetting = createAutoTopUpDeployment({ address, dseq: "3001" });
      const closedSetting = createAutoTopUpDeployment({ address, dseq: "3002" });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([activeSetting, closedSetting]);
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(activeSetting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 }),
        createDrainingDeployment({ dseq: Number(closedSetting.dseq), owner: address, predictedClosedHeight: currentHeight + 500, isClosed: true })
      ]);

      const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

      expect(result).toHaveLength(1);
      expect(result[0].dseq).toBe(activeSetting.dseq);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closedSetting.id]);
      expect(sink.recordDeploymentsMarkedClosed).toHaveBeenCalledWith(1);
    });

    it("marks closed deployments as closed and excludes them from the result", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const activeSetting = createAutoTopUpDeployment({ address, dseq: "2001" });
      const closedSetting = createAutoTopUpDeployment({ address, dseq: "2002" });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([activeSetting, closedSetting]);
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(activeSetting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 }),
        createDrainingDeployment({
          dseq: Number(closedSetting.dseq),
          owner: address,
          predictedClosedHeight: currentHeight + 500,
          closedHeight: currentHeight - 100
        })
      ]);

      const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

      expect(result).toHaveLength(1);
      expect(result[0].dseq).toBe(activeSetting.dseq);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closedSetting.id]);
      expect(sink.recordDeploymentsMarkedClosed).toHaveBeenCalledWith(1);
    });

    it("drops a deployment already funded to its runtime deadline and records the skip", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, deploymentSettingRepository, currentHeight } = setup();
        const sink = mock<DeploymentTopUpInstrumentation>();
        const address = createAkashAddress();
        const runtimeEndsAt = new Date(Date.now() + 2 * millisecondsInHour);
        const limitedSetting = createAutoTopUpDeployment({ address, dseq: "3001", runtimeLimitHours: 12, runtimeEndsAt });
        const unlimitedSetting = createAutoTopUpDeployment({ address, dseq: "3002" });

        deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([limitedSetting, unlimitedSetting]);
        vi.spyOn(service, "findLeases").mockResolvedValue([
          createDrainingDeployment({
            dseq: Number(limitedSetting.dseq),
            owner: address,
            predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 10
          }),
          createDrainingDeployment({ dseq: Number(unlimitedSetting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
        ]);

        const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

        expect(result).toHaveLength(1);
        expect(result[0].dseq).toBe(unlimitedSetting.dseq);
        expect(sink.recordRuntimeLimitReached).toHaveBeenCalledWith({ dseq: limitedSetting.dseq, address, runtimeEndsAt });
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps a runtime-limited deployment that still has unfunded runtime", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, deploymentSettingRepository, currentHeight } = setup();
        const sink = mock<DeploymentTopUpInstrumentation>();
        const address = createAkashAddress();
        const runtimeEndsAt = new Date(Date.now() + 10 * millisecondsInHour);
        const setting = createAutoTopUpDeployment({ address, dseq: "3003", runtimeLimitHours: 12, runtimeEndsAt });

        deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([setting]);
        vi.spyOn(service, "findLeases").mockResolvedValue([
          createDrainingDeployment({
            dseq: Number(setting.dseq),
            owner: address,
            predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 2
          })
        ]);

        const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ dseq: setting.dseq, runtimeEndsAt });
        expect(sink.recordRuntimeLimitReached).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("starts the runtime countdown for a limited deployment the initial funding never anchored", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, deploymentSettingRepository, currentHeight } = setup();
        const sink = mock<DeploymentTopUpInstrumentation>();
        const address = createAkashAddress();
        const anchoredEndsAt = new Date(Date.now() + 12 * millisecondsInHour);
        const setting = createAutoTopUpDeployment({ address, dseq: "3004", runtimeLimitHours: 12, runtimeEndsAt: null });

        deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([setting]);
        deploymentSettingRepository.startRuntimeCountdown.mockResolvedValue(anchoredEndsAt);
        vi.spyOn(service, "findLeases").mockResolvedValue([
          createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
        ]);

        const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

        expect(deploymentSettingRepository.startRuntimeCountdown).toHaveBeenCalledWith(setting.id);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ dseq: setting.dseq, runtimeEndsAt: anchoredEndsAt });
      } finally {
        vi.useRealTimers();
      }
    });

    it("schedules a close job for a deadline it just anchored", async () => {
      const { service, deploymentSettingRepository, deploymentCloseJobService, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const anchoredEndsAt = new Date(Date.now() + 12 * millisecondsInHour);
      const setting = createAutoTopUpDeployment({ address, dseq: "3010", runtimeLimitHours: 12, runtimeEndsAt: null });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([setting]);
      deploymentSettingRepository.startRuntimeCountdown.mockResolvedValue(anchoredEndsAt);
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
      ]);

      await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

      expect(deploymentCloseJobService.schedule).toHaveBeenCalledWith(
        { deploymentSettingId: setting.id, userId: setting.userId, dseq: setting.dseq },
        { startAfter: anchoredEndsAt, withCleanup: true }
      );
    });

    it("schedules no close job for a deadline that was already anchored", async () => {
      const { service, deploymentSettingRepository, deploymentCloseJobService, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const setting = createAutoTopUpDeployment({
        address,
        dseq: "3011",
        runtimeLimitHours: 12,
        runtimeEndsAt: new Date(Date.now() + 10 * millisecondsInHour)
      });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([setting]);
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
      ]);

      await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

      expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
    });

    it("still anchors and funds when the close job cannot be scheduled", async () => {
      const { service, deploymentSettingRepository, deploymentCloseJobService, currentHeight } = setup();
      const sink = mock<DeploymentTopUpInstrumentation>();
      const address = createAkashAddress();
      const anchoredEndsAt = new Date(Date.now() + 12 * millisecondsInHour);
      const setting = createAutoTopUpDeployment({ address, dseq: "3013", runtimeLimitHours: 12, runtimeEndsAt: null });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([setting]);
      deploymentSettingRepository.startRuntimeCountdown.mockResolvedValue(anchoredEndsAt);
      deploymentCloseJobService.schedule.mockRejectedValue(new Error("queue unavailable"));
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
      ]);

      const result = await service.findDrainingDeploymentsForOwner(address, sink, currentHeight);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ dseq: setting.dseq, runtimeEndsAt: anchoredEndsAt });
    });

    it("schedules no close job during a dry run", async () => {
      const { service, deploymentSettingRepository, deploymentCloseJobService, currentHeight } = setup();
      const address = createAkashAddress();
      const setting = createAutoTopUpDeployment({ address, dseq: "3012", runtimeLimitHours: 12, runtimeEndsAt: null });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address, walletId: setting.walletId, deploymentSettings: [setting] };
        })()
      );
      vi.spyOn(service, "findLeases").mockResolvedValue([
        createDrainingDeployment({ dseq: Number(setting.dseq), owner: address, predictedClosedHeight: currentHeight + 500 })
      ]);

      const callback = vi.fn();
      for await (const result of service.findDrainingDeploymentsByOwner(currentHeight, mock<DeploymentTopUpInstrumentation>(), { dryRun: true })) {
        callback(result);
      }

      expect(callback).toHaveBeenCalledTimes(1);
      expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
    });

    it("returns an empty array without querying leases when the owner has no auto-top-up deployments", async () => {
      const { service, deploymentSettingRepository, currentHeight } = setup();
      const findLeasesSpy = vi.spyOn(service, "findLeases");
      deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue([]);

      const result = await service.findDrainingDeploymentsForOwner(createAkashAddress(), mock<DeploymentTopUpInstrumentation>(), currentHeight);

      expect(result).toEqual([]);
      expect(findLeasesSpy).not.toHaveBeenCalled();
    });
  });

  describe("findLeases", () => {
    it("returns leases from RPC service when successful", async () => {
      const { service, rpcService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();
      const dseqs = [faker.string.numeric(6), faker.string.numeric(6)];
      const expectedLeases: DrainingDeploymentOutput[] = [
        createDrainingDeployment({ owner, dseq: Number(dseqs[0]) }),
        createDrainingDeployment({ owner, dseq: Number(dseqs[1]) })
      ];

      rpcService.findManyByDseqAndOwner.mockResolvedValue(expectedLeases);

      const result = await service.findLeases(closureHeight, owner, dseqs);

      expect(rpcService.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(result).toEqual(expectedLeases);
    });

    it("falls back to database when RPC fails", async () => {
      const { service, rpcService, leaseRepository, loggerService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();
      const dseqs = [faker.string.numeric(6), faker.string.numeric(6)];
      const rpcError = new Error("RPC error");
      const expectedLeases: DrainingDeploymentOutput[] = [
        createDrainingDeployment({ owner, dseq: Number(dseqs[0]) }),
        createDrainingDeployment({ owner, dseq: Number(dseqs[1]) })
      ];

      rpcService.findManyByDseqAndOwner.mockRejectedValue(rpcError);
      leaseRepository.findManyByDseqAndOwner.mockResolvedValue(expectedLeases);

      const result = await service.findLeases(closureHeight, owner, dseqs);

      expect(rpcService.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "LEASE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
          message: expect.stringContaining("RPC query failed for owner"),
          owner,
          error: rpcError
        })
      );
      expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(result).toEqual(expectedLeases);
    });

    it("returns empty array when dseqs is empty", async () => {
      const { service, rpcService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();

      const result = await service.findLeases(closureHeight, owner, []);

      expect(rpcService.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("calculateAmountToTargetRunway", () => {
    it("funds only the gap when the deployment already holds part of the target runway", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateAmountToTargetRunway(
        { blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 24 },
        currentHeight
      );

      expect(result).toBe(50 * averageBlockCountInAnHour * 24);
      expect(result).toBeLessThan(50 * averageBlockCountInAnHour * 48);
    });

    it("funds the full target when the escrow runs out right now", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight }, currentHeight);

      expect(result).toBe(1440000);
    });

    it("caps an overdue deployment at the target instead of funding its arrears", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight - 5000 }, currentHeight);

      expect(result).toBe(1440000);
    });

    it("returns 0 when the deployment already holds more than the target runway", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateAmountToTargetRunway(
        { blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 72 },
        currentHeight
      );

      expect(result).toBe(0);
    });

    it("returns 0 for a non-positive block rate", () => {
      const { service, currentHeight } = setup();

      expect(service.calculateAmountToTargetRunway({ blockRate: 0, predictedClosedHeight: currentHeight }, currentHeight)).toBe(0);
      expect(service.calculateAmountToTargetRunway({ blockRate: -5, predictedClosedHeight: currentHeight }, currentHeight)).toBe(0);
    });

    it("returns 0 rather than NaN when the predicted close height is missing", () => {
      const { service, currentHeight } = setup();
      const withoutPredictedCloseHeight = { blockRate: 50, predictedClosedHeight: undefined } as unknown as Pick<
        DrainingDeploymentOutput,
        "blockRate" | "predictedClosedHeight"
      >;

      const result = service.calculateAmountToTargetRunway(withoutPredictedCloseHeight, currentHeight);

      expect(result).toBe(0);
      expect(Number.isNaN(result)).toBe(false);
    });

    it("handles the numeric strings the database fallback returns", () => {
      const { service, currentHeight } = setup();
      const fromDatabaseFallback = {
        blockRate: "50",
        predictedClosedHeight: String(currentHeight + averageBlockCountInAnHour * 24)
      } as unknown as Pick<DrainingDeploymentOutput, "blockRate" | "predictedClosedHeight">;

      const result = service.calculateAmountToTargetRunway(fromDatabaseFallback, currentHeight);

      expect(result).toBe(50 * averageBlockCountInAnHour * 24);
    });

    it("floors a decimal block rate", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateAmountToTargetRunway({ blockRate: 10.7, predictedClosedHeight: currentHeight }, currentHeight);

      expect(result).toBe(308160);
    });

    it("derives the amount from the given height without querying the chain", () => {
      const { service, blockHttpService, currentHeight } = setup();

      service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight }, currentHeight);

      expect(blockHttpService.getCurrentHeight).not.toHaveBeenCalled();
    });

    it("clamps the target to a runtime deadline that lands inside the runway target", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, currentHeight } = setup();
        const runtimeEndsAt = new Date(Date.now() + 12 * millisecondsInHour);

        const result = service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight, runtimeEndsAt }, currentHeight);

        expect(result).toBe(Math.floor(50 * averageBlockCountInAnHour * 12));
      } finally {
        vi.useRealTimers();
      }
    });

    it("ignores a runtime deadline beyond the runway target", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, currentHeight } = setup();
        const runtimeEndsAt = new Date(Date.now() + 100 * millisecondsInHour);

        const result = service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight, runtimeEndsAt }, currentHeight);

        expect(result).toBe(Math.floor(50 * averageBlockCountInAnHour * 48));
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns 0 when the deployment is already funded up to its runtime deadline", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, currentHeight } = setup();
        const runtimeEndsAt = new Date(Date.now() + 12 * millisecondsInHour);

        const result = service.calculateAmountToTargetRunway(
          { blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 20, runtimeEndsAt },
          currentHeight
        );

        expect(result).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns 0 when the runtime deadline has passed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, currentHeight } = setup();
        const runtimeEndsAt = new Date(Date.now() - millisecondsInHour);

        const result = service.calculateAmountToTargetRunway({ blockRate: 50, predictedClosedHeight: currentHeight, runtimeEndsAt }, currentHeight);

        expect(result).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("calculateRunwayMinutesAfterDeposit", () => {
    it("adds the runway a deposit buys to the runway the escrow already covers", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateRunwayMinutesAfterDeposit(
        { blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 2 },
        50 * averageBlockCountInAnHour * 3,
        currentHeight
      );

      expect(result).toBe(5 * minutesInHour);
    });

    it("counts only what the deposit buys for a deployment already in arrears", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateRunwayMinutesAfterDeposit(
        { blockRate: 50, predictedClosedHeight: currentHeight - averageBlockCountInAnHour * 10 },
        50 * averageBlockCountInAnHour,
        currentHeight
      );

      expect(result).toBe(minutesInHour);
    });

    it("reports the runway the escrow still covers when nothing is deposited", () => {
      const { service, currentHeight } = setup();

      const result = service.calculateRunwayMinutesAfterDeposit(
        { blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour },
        0,
        currentHeight
      );

      expect(result).toBe(minutesInHour);
    });

    it("returns 0 for a non-positive block rate", () => {
      const { service, currentHeight } = setup();

      expect(service.calculateRunwayMinutesAfterDeposit({ blockRate: 0, predictedClosedHeight: currentHeight }, 1000, currentHeight)).toBe(0);
      expect(service.calculateRunwayMinutesAfterDeposit({ blockRate: -5, predictedClosedHeight: currentHeight }, 1000, currentHeight)).toBe(0);
    });

    it("returns 0 rather than NaN when the predicted close height is missing", () => {
      const { service, currentHeight } = setup();
      const withoutPredictedCloseHeight = { blockRate: 50, predictedClosedHeight: undefined } as unknown as Pick<
        DrainingDeploymentOutput,
        "blockRate" | "predictedClosedHeight"
      >;

      expect(service.calculateRunwayMinutesAfterDeposit(withoutPredictedCloseHeight, 1000, currentHeight)).toBe(0);
    });
  });

  describe("calculateSteadyStateTopUpAmount", () => {
    it("reports the cost of the hours between the look-ahead window and the target", () => {
      const { service } = setup();

      const result = service.calculateSteadyStateTopUpAmount({ blockRate: 50 });

      expect(result).toBe(50 * averageBlockCountInAnHour * 24);
    });

    it("floors a decimal block rate", () => {
      const { service } = setup();

      expect(service.calculateSteadyStateTopUpAmount({ blockRate: 10.7 })).toBe(154080);
    });

    it("stays a function of configuration alone, ignoring how much runway is held", () => {
      const { service, currentHeight } = setup();

      const wellFunded = service.calculateSteadyStateTopUpAmount(
        createDrainingDeployment({ blockRate: 50, predictedClosedHeight: currentHeight + averageBlockCountInAnHour * 168 })
      );
      const draining = service.calculateSteadyStateTopUpAmount(createDrainingDeployment({ blockRate: 50, predictedClosedHeight: currentHeight }));

      expect(wellFunded).toBe(draining);
    });
  });

  describe("calculateTopUpAmountForDseqAndUserId", () => {
    it("calculates top up amount for valid deployment", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const address = createAkashAddress();
      const deployment = createDrainingDeployment();
      const userWallet = createUserWallet({ address });
      const expectedTopUpAmount = 100000;

      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(deployment);
      vi.spyOn(service, "calculateSteadyStateTopUpAmount").mockReturnValue(expectedTopUpAmount);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(service.calculateSteadyStateTopUpAmount).toHaveBeenCalledWith(deployment);
      expect(amount).toBe(expectedTopUpAmount);
    });

    it("returns 0 when user wallet not found", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).not.toHaveBeenCalled();
      expect(amount).toBe(0);
    });

    it("returns 0 when lease not found", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const address = createAkashAddress();
      const userWallet = createUserWallet({ address });
      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(null);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(amount).toBe(0);
    });
  });

  describe("calculateWeeklyDeploymentCost", () => {
    it("calculates weekly cost for all active deployments", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [{ blockRate: 50 }, { blockRate: 75 }],
        expectedFiatAmount: 12.5
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(12.5);
    });

    it("returns 0 when user wallet not found", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        userWallet: undefined,
        deployments: [{ blockRate: 50 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("returns 0 when user wallet has no address", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        userWallet: createUserWallet({ address: null }),
        deployments: [{ blockRate: 50 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("returns 0 when no deployments found", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: []
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("excludes deployments with blockRate <= 0", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [{ blockRate: 0 }, { blockRate: -10 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("caps a runtime-limited deployment at its remaining hours like the credits-low threshold", async () => {
      const blockRate = 50;
      const runtimeLimitHours = 12;
      const { service, userId, ability, balancesService } = await setupCalculateWeeklyCost({
        deployments: [{ blockRate, runtimeLimitHours }],
        expectedFiatAmount: 3.6
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(balancesService.toFiatAmount).toHaveBeenCalledWith(Math.floor(blockRate * averageBlockCountInAnHour * runtimeLimitHours));
      expect(result).toBe(3.6);
    });

    async function setupCalculateWeeklyCost(input: {
      userWallet?: ReturnType<typeof createUserWallet> | undefined;
      deployments: Array<{ blockRate: number; runtimeLimitHours?: number }>;
      expectedFiatAmount?: number;
    }) {
      const userId = faker.string.uuid();
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : createUserWallet({ address, userId });
      const ability = mock<AnyAbility>();

      const baseSetup = setup();
      baseSetup.userWalletRepository.accessibleBy.mockReturnValue(baseSetup.userWalletRepository);
      baseSetup.userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      baseSetup.userWalletRepository.findOneBy.mockResolvedValue(userWallet);

      const deploymentSettings = input.deployments.map(deployment =>
        createAutoTopUpDeployment({ address, runtimeLimitHours: deployment.runtimeLimitHours ?? null })
      );
      const leaseRates = deploymentSettings.map((setting, idx) => ({
        dseq: setting.dseq,
        blockRate: input.deployments[idx]?.blockRate ?? 0
      }));

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      baseSetup.rpcService.findActiveLeaseRates.mockRejectedValue(new Error("RPC error"));
      baseSetup.leaseRepository.findActiveLeaseRates.mockResolvedValue(leaseRates);

      baseSetup.balancesService.toFiatAmount.mockImplementation(async (uaktAmount: number) => {
        if (uaktAmount === 0) {
          return 0;
        }
        return input.expectedFiatAmount ?? 0;
      });

      return {
        ...baseSetup,
        userId,
        ability
      };
    }
  });

  describe("calculateWeeklyCoverageForAddress", () => {
    it("calculates seven days of burn in fiat for always-on deployments still open", async () => {
      const blockRate1 = 50;
      const blockRate2 = 75;
      const { service, address, balancesService, userWalletRepository, deploymentSettingRepository } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate: blockRate1 }, { blockRate: blockRate2 }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      const creditsForDays = (days: number) =>
        Math.floor(blockRate1 * averageBlockCountInAnHour * 24 * days) + Math.floor(blockRate2 * averageBlockCountInAnHour * 24 * days);
      const expectedCredits = creditsForDays(7);
      expect(userWalletRepository.accessibleBy).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.accessibleBy).not.toHaveBeenCalled();
      expect(balancesService.toFiatAmount).toHaveBeenCalledWith(expectedCredits);
      expect(result.weeklyCostUsd).toBe(usdFromCredits(expectedCredits));
      expect(result.cumulativeDailyCostsUsd).toEqual(Array.from({ length: 7 }, (_, day) => (creditsForDays(day + 1) / expectedCredits) * result.weeklyCostUsd));
    });

    it("bills twelve hours of burn when the runtime deadline is twelve hours away", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const blockRate = 50;
        const runtimeEndsAt = new Date(Date.now() + 12 * millisecondsInHour);
        const { service, address, balancesService } = await setupWeeklyBurnForAddress({
          deployments: [
            {
              blockRate,
              runtimeLimitHours: 24,
              runtimeEndsAt
            }
          ]
        });

        const result = await service.calculateWeeklyCoverageForAddress(address);

        const expectedCredits = Math.floor(blockRate * averageBlockCountInAnHour * 12);
        const weekCredits = Math.floor(blockRate * averageBlockCountInAnHour * 24 * 7);
        expect(balancesService.toFiatAmount).toHaveBeenCalledWith(expectedCredits);
        expect(balancesService.toFiatAmount).not.toHaveBeenCalledWith(weekCredits);
        expect(result.weeklyCostUsd).toBe(usdFromCredits(expectedCredits));
        expect(result.cumulativeDailyCostsUsd).toEqual(Array.from({ length: 7 }, () => result.weeklyCostUsd));
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns 0 when the runtime deadline is in the past", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const { service, address, balancesService } = await setupWeeklyBurnForAddress({
          deployments: [
            {
              blockRate: 50,
              runtimeLimitHours: 12,
              runtimeEndsAt: new Date(Date.now() - millisecondsInHour)
            }
          ]
        });

        const result = await service.calculateWeeklyCoverageForAddress(address);

        expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: true });
        expect(balancesService.toFiatAmount).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("bills three hours of burn for an unanchored runtime limit", async () => {
      const blockRate = 50;
      const { service, address, balancesService, deploymentSettingRepository } = await setupWeeklyBurnForAddress({
        deployments: [
          {
            blockRate,
            runtimeLimitHours: 3,
            runtimeEndsAt: null
          }
        ]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      const expectedCredits = Math.floor(blockRate * averageBlockCountInAnHour * 3);
      expect(deploymentSettingRepository.startRuntimeCountdown).not.toHaveBeenCalled();
      expect(balancesService.toFiatAmount).toHaveBeenCalledWith(expectedCredits);
      expect(result.weeklyCostUsd).toBe(usdFromCredits(expectedCredits));
      expect(result.cumulativeDailyCostsUsd).toEqual(Array.from({ length: 7 }, () => result.weeklyCostUsd));
    });

    it("front-loads a short runtime limit into the first day while an always-on deployment accrues daily", async () => {
      const limitedBlockRate = 500;
      const alwaysOnBlockRate = 10;
      const { service, address } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate: limitedBlockRate, runtimeLimitHours: 2, runtimeEndsAt: null }, { blockRate: alwaysOnBlockRate }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      const limitedCredits = Math.floor(limitedBlockRate * averageBlockCountInAnHour * 2);
      const alwaysOnCreditsForDays = (days: number) => Math.floor(alwaysOnBlockRate * averageBlockCountInAnHour * 24 * days);
      const weeklyCredits = limitedCredits + alwaysOnCreditsForDays(7);
      expect(result.weeklyCostUsd).toBe(usdFromCredits(weeklyCredits));
      expect(result.cumulativeDailyCostsUsd).toEqual(
        Array.from({ length: 7 }, (_, day) => ((limitedCredits + alwaysOnCreditsForDays(day + 1)) / weeklyCredits) * result.weeklyCostUsd)
      );
    });

    it("bills a deployment whose escrow has already run dry, since it keeps running and keeps billing", async () => {
      const blockRate = 50;
      const { service, address, balancesService, rpcService } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(rpcService.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(balancesService.toFiatAmount).toHaveBeenCalledWith(Math.floor(blockRate * averageBlockCountInAnHour * 24 * 7));
      expect(result.weeklyCostUsd).toBeGreaterThan(0);
    });

    it("bills a deployment whose lease rate comes back with leading zeros", async () => {
      const blockRate = 50;
      const { service, address, rpcService, deploymentSettings, balancesService } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate }]
      });
      rpcService.findActiveLeaseRates.mockResolvedValue([{ dseq: `000${deploymentSettings[0].dseq}`, blockRate }]);

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(balancesService.toFiatAmount).toHaveBeenCalledWith(Math.floor(blockRate * averageBlockCountInAnHour * 24 * 7));
      expect(result.weeklyCostUsd).toBeGreaterThan(0);
    });

    it("ignores a lease rate that matches no auto top-up deployment", async () => {
      const { service, address, rpcService, loggerService } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate: 50 }]
      });
      rpcService.findActiveLeaseRates.mockResolvedValue([{ dseq: "999999", blockRate: 50 }]);

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: true });
      expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ACTIVE_LEASE_RATE_WITHOUT_SETTING", dseq: "999999", address }));
    });

    it("falls back to the database when the lease rate query fails", async () => {
      const blockRate = 50;
      const rpcError = new Error("RPC error");
      const { service, address, leaseRepository, loggerService, deploymentSettings } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate }],
        rpcError
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(leaseRepository.findActiveLeaseRates).toHaveBeenCalledWith(
        address,
        deploymentSettings.map(setting => setting.dseq)
      );
      expect(loggerService.error).toHaveBeenCalledWith(expect.objectContaining({ event: "ACTIVE_LEASE_RATE_RPC_QUERY_FAILED_FALLBACK_TO_DB" }));
      expect(result.weeklyCostUsd).toBe(usdFromCredits(Math.floor(blockRate * averageBlockCountInAnHour * 24 * 7)));
    });

    it("reports no auto top-up settings when user wallet is not found", async () => {
      const { service, address } = await setupWeeklyBurnForAddress({
        userWallet: undefined,
        deployments: [{ blockRate: 50 }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: false });
    });

    it("reports no auto top-up settings when user wallet has no address", async () => {
      const { service, address } = await setupWeeklyBurnForAddress({
        userWallet: createUserWallet({ address: null }),
        deployments: [{ blockRate: 50 }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: false });
    });

    it("reports no auto top-up settings when no deployments are found", async () => {
      const { service, address } = await setupWeeklyBurnForAddress({
        deployments: []
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: false });
    });

    it("returns 0 when block rate is zero", async () => {
      const { service, address, balancesService } = await setupWeeklyBurnForAddress({
        deployments: [{ blockRate: 0 }]
      });

      const result = await service.calculateWeeklyCoverageForAddress(address);

      expect(result).toEqual({ weeklyCostUsd: 0, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: true });
      expect(balancesService.toFiatAmount).not.toHaveBeenCalled();
    });

    function usdFromCredits(credits: number) {
      return Number((credits / 1_000_000).toFixed(2));
    }

    async function setupWeeklyBurnForAddress(input: {
      userWallet?: ReturnType<typeof createUserWallet> | undefined;
      deployments: Array<{
        blockRate: number;
        runtimeLimitHours?: number | null;
        runtimeEndsAt?: Date | null;
      }>;
      rpcError?: Error;
    }) {
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : createUserWallet({ address });

      const baseSetup = setup();
      baseSetup.userWalletRepository.findOneBy.mockResolvedValue(userWallet);

      const deploymentSettings = input.deployments.map((deployment, idx) =>
        createAutoTopUpDeployment({
          address,
          dseq: String(1000 + idx),
          runtimeLimitHours: deployment.runtimeLimitHours ?? null,
          runtimeEndsAt: deployment.runtimeEndsAt ?? null
        })
      );
      const leaseRates = deploymentSettings.map((setting, idx) => ({
        dseq: setting.dseq,
        blockRate: input.deployments[idx]?.blockRate ?? 0
      }));

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      if (input.rpcError) {
        baseSetup.rpcService.findActiveLeaseRates.mockRejectedValue(input.rpcError);
        baseSetup.leaseRepository.findActiveLeaseRates.mockResolvedValue(leaseRates);
      } else {
        baseSetup.rpcService.findActiveLeaseRates.mockResolvedValue(leaseRates);
      }

      baseSetup.balancesService.toFiatAmount.mockImplementation(async (uaktAmount: number) => usdFromCredits(uaktAmount));

      return {
        ...baseSetup,
        address,
        deploymentSettings
      };
    }
  });

  describe("calculateAllDeploymentCostUntilDate", () => {
    it("calculates total cost for deployments closing within target date", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const blockRate1 = 50;
        const blockRate2 = 75;
        const baseSetup = setup();
        const deployments = [
          { predictedClosedHeight: baseSetup.currentHeight + 100, blockRate: blockRate1 },
          { predictedClosedHeight: baseSetup.currentHeight + 200, blockRate: blockRate2 }
        ];

        const { service, address, targetDate, leaseRepository } = await setupCalculateCost({
          deployments
        });
        const expectedTargetHeight = 1100800;
        const expectedTotal = deployments.reduce((sum, d) => {
          const blocksNeeded = expectedTargetHeight - d.predictedClosedHeight;
          return sum + Math.floor(d.blockRate * blocksNeeded);
        }, 0);

        const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

        expect(result).toBe(expectedTotal);
        expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(expectedTargetHeight, address, expect.any(Array));
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns 0 when user wallet not found", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: undefined,
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when user wallet has no address", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: createUserWallet({ address: null }),
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when no deployments found", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: []
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments with null predictedClosedHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: null as unknown as number, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing before currentHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: 999900, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing after targetHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: 3000000, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    async function setupCalculateCost(input: {
      userWallet?: ReturnType<typeof createUserWallet> | undefined;
      deployments: Array<{ predictedClosedHeight: number | null; blockRate: number }>;
    }) {
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : createUserWallet({ address });
      const now = new Date();
      const targetDate = addWeeks(now, 1);

      const baseSetup = setup();
      baseSetup.userWalletRepository.findOneBy.mockResolvedValue(userWallet);

      const deploymentSettings = createManyAutoTopUpDeployments(input.deployments.length, { address });

      const drainingDeployments = deploymentSettings.map((setting, idx) => {
        const deployment = input.deployments[idx];
        const predictedClosedHeight = deployment?.predictedClosedHeight ?? undefined;
        return createDrainingDeployment({
          dseq: Number(setting.dseq),
          owner: address,
          predictedClosedHeight: predictedClosedHeight === null ? undefined : predictedClosedHeight,
          blockRate: deployment?.blockRate ?? 0
        });
      });

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      baseSetup.rpcService.findManyByDseqAndOwner.mockRejectedValue(new Error("RPC error"));
      baseSetup.leaseRepository.findManyByDseqAndOwner.mockImplementation((_closureHeight, _owner, _dseqs) => Promise.resolve(drainingDeployments));

      return {
        ...baseSetup,
        address,
        targetDate
      };
    }
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DrainingDeploymentService.name });
  });

  function setup() {
    const currentHeight = 1000000;

    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentHeight);

    const leaseRepository = mock<LeaseRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const deploymentCloseJobService = mock<DeploymentCloseJobService>();
    const rpcService = mock<DrainingDeploymentRpcService>();
    const loggerService = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => loggerService);
    const balancesService = mock<BalancesService>();

    rpcService.findManyByDseqAndOwner.mockResolvedValue([]);

    const config = mockConfigService<DeploymentConfigService>({
      AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24,
      AUTO_TOP_UP_TARGET_RUNWAY_IN_H: 48
    });

    const service = new DrainingDeploymentService(
      blockHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      deploymentCloseJobService,
      config,
      createLogger,
      rpcService,
      balancesService
    );

    return {
      service,
      blockHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      deploymentCloseJobService,
      rpcService,
      loggerService,
      createLogger,
      balancesService,
      config,
      currentHeight
    };
  }
});
