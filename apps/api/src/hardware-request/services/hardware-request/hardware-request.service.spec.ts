import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestConfig } from "@src/hardware-request/config/env.config";
import type { HardwareRequestInput } from "@src/hardware-request/http-schemas/hardware-request.schema";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { HardwareRequestSlackAlertJob } from "@src/hardware-request/services/hardware-request-slack-alert/hardware-request-slack-alert.handler";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestService } from "./hardware-request.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-09-29T12:00:00.000Z").getTime();
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function minutesAgo(minutes: number) {
  return new Date(NOW - minutes * MINUTE_MS);
}

describe(HardwareRequestService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("records the request for the current user under their contact email", async () => {
      const { service, hardwareRequestRepository, user } = setup();

      await service.create({ category: "gpu_model", gpuModel: "B200", quantity: 8, details: "Training run", email: "jane@example.com" });

      expect(hardwareRequestRepository.create).toHaveBeenCalledWith({
        category: "gpu_model",
        gpuModel: "B200",
        quantity: 8,
        details: "Training run",
        contactEmail: "jane@example.com",
        userId: user.id
      });
    });

    it("creates the request through the current user's create ability", async () => {
      const { service, hardwareRequestRepository, authService } = setup();

      await service.create(anInput());

      expect(hardwareRequestRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
    });

    it("returns the created request", async () => {
      const { service, created } = setup();

      await expect(service.create(anInput())).resolves.toEqual(created);
    });

    it("queues the email and the Slack alert for the created request in the same transaction", async () => {
      const { service, jobQueueService, txService, created } = setup();

      await service.create(anInput());

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue.mock.calls).toEqual([
        [new HardwareRequestEmailJob({ hardwareRequestId: created.id })],
        [new HardwareRequestSlackAlertJob({ hardwareRequestId: created.id })]
      ]);
    });

    it("locks the user row before counting their recent requests", async () => {
      const { service, userRepository, hardwareRequestRepository, user } = setup();

      await service.create(anInput());

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id });
      expect(userRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        hardwareRequestRepository.findCreationTimesSince.mock.invocationCallOrder[0]
      );
    });

    it("counts the user's requests over the last 24 hours", async () => {
      const { service, hardwareRequestRepository, user } = setup();

      await service.create(anInput());

      expect(hardwareRequestRepository.findCreationTimesSince).toHaveBeenCalledWith(user.id, new Date(NOW - 24 * HOUR_MS));
    });

    it("accepts a request while the last hour holds one fewer than the hourly limit", async () => {
      const { service, hardwareRequestRepository } = setup({ creationTimes: [minutesAgo(30), minutesAgo(10)] });

      await service.create(anInput());

      expect(hardwareRequestRepository.create).toHaveBeenCalled();
    });

    it("refuses a request once the last hour holds the hourly limit", async () => {
      const { service, hardwareRequestRepository, jobQueueService } = setup({ creationTimes: [minutesAgo(50), minutesAgo(30), minutesAgo(10)] });

      await expect(service.create(anInput())).rejects.toMatchObject({
        status: 429,
        errorCode: "hardware_request_limit",
        message: "You can send up to 3 requests an hour. Try again later, or ask us on Discord."
      });
      expect(hardwareRequestRepository.create).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("tells the user to retry once the oldest request of the hour leaves it", async () => {
      const oldest = new Date(NOW - 50 * MINUTE_MS + 500);
      const { service } = setup({ creationTimes: [oldest, minutesAgo(30), minutesAgo(10)] });

      await expect(service.create(anInput())).rejects.toMatchObject({ headers: { "Retry-After": "601" } });
    });

    it("leaves requests older than an hour out of the hourly limit", async () => {
      const { service, hardwareRequestRepository } = setup({ creationTimes: [minutesAgo(61), minutesAgo(60), minutesAgo(10), minutesAgo(5)] });

      await service.create(anInput());

      expect(hardwareRequestRepository.create).toHaveBeenCalled();
    });

    it("accepts a request while the last day holds one fewer than the daily limit", async () => {
      const { service, hardwareRequestRepository } = setup({ creationTimes: hoursAgo([20, 18, 16, 14, 12, 10, 8, 6, 4]) });

      await service.create(anInput());

      expect(hardwareRequestRepository.create).toHaveBeenCalled();
    });

    it("refuses a request once the last day holds the daily limit, until its oldest request leaves the day", async () => {
      const { service, hardwareRequestRepository } = setup({ creationTimes: hoursAgo([20, 18, 16, 14, 12, 10, 8, 6, 4, 2]) });

      await expect(service.create(anInput())).rejects.toMatchObject({
        status: 429,
        errorCode: "hardware_request_limit",
        message: "You can send up to 10 requests a day. Try again later, or ask us on Discord.",
        headers: { "Retry-After": String(4 * 60 * 60) }
      });
      expect(hardwareRequestRepository.create).not.toHaveBeenCalled();
    });

    it("reports the daily limit when both are reached and the day lifts later", async () => {
      const { service } = setup({ creationTimes: [...hoursAgo([20, 18, 16, 14, 12, 10, 8]), minutesAgo(40), minutesAgo(20), minutesAgo(10)] });

      await expect(service.create(anInput())).rejects.toMatchObject({
        message: expect.stringContaining("a day"),
        headers: { "Retry-After": String(4 * 60 * 60) }
      });
    });

    it("reports the hourly limit when both are reached and the hour lifts later", async () => {
      const dayOldestAlmostGone = new Date(NOW - 24 * HOUR_MS + 60 * 1000);
      const { service } = setup({
        creationTimes: [dayOldestAlmostGone, ...hoursAgo([20, 18, 16, 14, 12, 10]), minutesAgo(10), minutesAgo(5), minutesAgo(1)]
      });

      await expect(service.create(anInput())).rejects.toMatchObject({
        message: expect.stringContaining("an hour"),
        headers: { "Retry-After": String(50 * 60) }
      });
    });

    it("waits for enough requests to leave a window that holds more than the limit", async () => {
      const { service } = setup({ config: { HARDWARE_REQUEST_HOURLY_LIMIT: 2 }, creationTimes: [minutesAgo(50), minutesAgo(40), minutesAgo(30)] });

      await expect(service.create(anInput())).rejects.toMatchObject({ headers: { "Retry-After": String(20 * 60) } });
    });

    it("applies the configured limits", async () => {
      const { service } = setup({ config: { HARDWARE_REQUEST_HOURLY_LIMIT: 1 }, creationTimes: [minutesAgo(5)] });

      await expect(service.create(anInput())).rejects.toMatchObject({
        message: "You can send up to 1 requests an hour. Try again later, or ask us on Discord."
      });
    });
  });

  function hoursAgo(hours: number[]) {
    return hours.map(value => new Date(NOW - value * HOUR_MS));
  }

  function anInput(): HardwareRequestInput {
    return { category: "region", region: "Frankfurt", email: "jane@example.com" };
  }

  function setup(input: { creationTimes?: Date[]; config?: Partial<HardwareRequestConfig> } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const created = createHardwareRequest({ userId: user.id });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.accessibleBy.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findCreationTimesSince.mockResolvedValue(input.creationTimes ?? []);
    hardwareRequestRepository.create.mockResolvedValue(created);
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();
    const config: HardwareRequestConfig = {
      HARDWARE_REQUEST_EMAIL: "support@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 3,
      HARDWARE_REQUEST_DAILY_LIMIT: 10,
      ...input.config
    };

    const service = new HardwareRequestService(hardwareRequestRepository, userRepository, authService, txService, jobQueueService, config);

    return { service, hardwareRequestRepository, userRepository, jobQueueService, txService, authService, user, created };
  }
});
