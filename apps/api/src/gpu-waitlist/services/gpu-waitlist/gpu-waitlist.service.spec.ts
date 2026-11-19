import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/config/env.config";
import type { JoinGpuWaitlistRequest } from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { AskStillWanted } from "@src/gpu-waitlist/services/still-wanted/ask-still-wanted.job";
import type { UserRepository } from "@src/user/repositories";
import { GpuWaitlistService } from "./gpu-waitlist.service";

import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-11-18T12:00:00.000Z").getTime();
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function minutesAgo(minutes: number) {
  return new Date(NOW - minutes * MINUTE_MS);
}

function anEntry(overrides: Partial<GpuWaitlistEntryRow> = {}): GpuWaitlistEntryRow {
  return {
    id: "entry-1",
    userId: "user-1",
    organizationId: null,
    vendor: "nvidia",
    model: "h100",
    memory: null,
    interface: null,
    poolKey: "nvidia/h100/*/*",
    gpuCount: 8,
    source: "gpu_menu",
    status: "waiting",
    joinedAt: new Date(NOW - 5 * HOUR_MS),
    lastNotifiedAt: null,
    notifiedCount: 0,
    stillWantedAskedAt: null,
    endedAt: null,
    createdAt: new Date(NOW - 5 * HOUR_MS),
    updatedAt: new Date(NOW - 5 * HOUR_MS),
    ...overrides
  };
}

const INPUT: JoinGpuWaitlistRequest["data"] = { vendor: "nvidia", model: "H100", gpuCount: 4, source: "no_bids" };

describe(GpuWaitlistService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("join", () => {
    it("files a new entry under the pool key of the setup and reports the place in line", async () => {
      const { service, repository, user } = setup({ placeInLine: 3 });

      const entry = await service.join(INPUT);

      expect(repository.create).toHaveBeenCalledWith({ ...INPUT, userId: user.id, poolKey: "nvidia/h100/*/*" });
      expect(entry.placeInLine).toBe(3);
    });

    it("schedules the still-wanted question 30 days after a new entry joined", async () => {
      const { service, jobQueueService } = setup();

      const entry = await service.join(INPUT);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new AskStillWanted({ entryId: entry.id }), {
        startAfter: new Date(entry.joinedAt.getTime() + 30 * DAY_MS)
      });
    });

    it("does not schedule another question when the same pool is joined again", async () => {
      const existing = anEntry();
      const { service, repository, jobQueueService } = setup({ existing });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(existing));

      await service.join(INPUT);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("answers a pending still-wanted question and schedules the next one when the same pool is joined again", async () => {
      const existing = anEntry({ stillWantedAskedAt: new Date(NOW - DAY_MS) });
      const { service, repository, jobQueueService } = setup({ existing });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...existing, gpuCount: 4 }));
      repository.clearPendingStillWantedQuestion.mockResolvedValue({ ...existing, gpuCount: 4, stillWantedAskedAt: null });

      const entry = await service.join(INPUT);

      expect(repository.clearPendingStillWantedQuestion).toHaveBeenCalledWith(existing.id);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new AskStillWanted({ entryId: existing.id }), { startAfter: new Date(NOW + 30 * DAY_MS) });
      expect(entry).toMatchObject({ id: existing.id, gpuCount: 4, stillWantedAskedAt: null });
    });

    it("joining the same pool twice updates the gpu count and keeps the place in line", async () => {
      const existing = anEntry();
      const { service, repository } = setup({ existing });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...existing, gpuCount: 4, source: "no_bids" }));

      const entry = await service.join(INPUT);

      expect(repository.updateBy).toHaveBeenCalledWith({ id: existing.id, status: "waiting" }, { gpuCount: 4, source: "no_bids" }, { returning: true });
      expect(repository.create).not.toHaveBeenCalled();
      expect(entry).toMatchObject({ id: existing.id, gpuCount: 4, joinedAt: existing.joinedAt });
    });

    it("files a new entry when the waiting entry was left before the refresh", async () => {
      const existing = anEntry();
      const { service, repository, user } = setup({ existing });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(undefined));

      const entry = await service.join(INPUT);

      expect(repository.create).toHaveBeenCalledWith({ ...INPUT, userId: user.id, poolKey: "nvidia/h100/*/*" });
      expect(entry.status).toBe("waiting");
    });

    it("refuses an 11th active entry", async () => {
      const { service, repository } = setup({ waitingCount: 10 });

      await expect(service.join(INPUT)).rejects.toMatchObject({ status: 409, errorCode: "gpu_waitlist_active_limit" });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("lets a user at the cap refresh an entry they already hold", async () => {
      const existing = anEntry();
      const { service, repository } = setup({ waitingCount: 10, existing });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(existing));

      await service.join(INPUT);

      expect(repository.updateBy).toHaveBeenCalled();
    });

    it("refuses joins past the hourly limit with Retry-After", async () => {
      const oldest = new Date(NOW - 50 * MINUTE_MS + 500);
      const joinTimes = [oldest, ...Array.from({ length: 9 }, (_, index) => minutesAgo(30 - index))];
      const { service, repository } = setup({ joinTimes });

      await expect(service.join(INPUT)).rejects.toMatchObject({
        status: 429,
        errorCode: "gpu_waitlist_join_limit",
        message: "You can join up to 10 GPU waitlists an hour. Try again later.",
        headers: { "Retry-After": "601" }
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("refuses joins past the daily limit and waits for the latest release", async () => {
      const joinTimes = Array.from({ length: 30 }, (_, index) => new Date(NOW - (23 - index * 0.5) * HOUR_MS));
      const { service } = setup({ joinTimes });

      await expect(service.join(INPUT)).rejects.toMatchObject({
        status: 429,
        message: "You can join up to 30 GPU waitlists a day. Try again later.",
        headers: { "Retry-After": String(Math.ceil((joinTimes[0].getTime() - (NOW - 24 * HOUR_MS)) / 1000)) }
      });
    });

    it("ignores joins older than an hour for the hourly limit", async () => {
      const joinTimes = Array.from({ length: 10 }, (_, index) => minutesAgo(61 + index));
      const { service, repository } = setup({ joinTimes });

      await service.join(INPUT);

      expect(repository.create).toHaveBeenCalled();
    });

    it("lets a user over the hourly limit refresh an entry they already hold", async () => {
      const existing = anEntry();
      const joinTimes = Array.from({ length: 10 }, (_, index) => minutesAgo(30 - index));
      const { service, repository } = setup({ existing, joinTimes });
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(existing));

      await service.join(INPUT);

      expect(repository.updateBy).toHaveBeenCalled();
    });

    it("locks the user row before looking for an existing entry or checking limits", async () => {
      const { service, userRepository, repository, user } = setup();

      await service.join(INPUT);

      const [lockOrder] = userRepository.findOneByAndLock.mock.invocationCallOrder;
      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id }, { strength: "no key update" });
      expect(lockOrder).toBeLessThan(repository.findWaitingInPoolOf.mock.invocationCallOrder[0]);
      expect(lockOrder).toBeLessThan(repository.findJoinTimesAcrossOrganizationsSince.mock.invocationCallOrder[0]);
    });
  });

  describe("list", () => {
    it("pairs every waiting entry with its place in line", async () => {
      const { service, repository } = setup({ placeInLine: 2 });
      repository.findWaitingNewestFirst.mockResolvedValue([anEntry({ id: "a" }), anEntry({ id: "b" })]);

      const entries = await service.list();

      expect(entries).toMatchObject([
        { id: "a", placeInLine: 2 },
        { id: "b", placeInLine: 2 }
      ]);
    });
  });

  describe("leave", () => {
    it("marks the waiting entry as left", async () => {
      const { service, repository } = setup();
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(anEntry({ status: "left" })));

      await service.leave("entry-1");

      expect(repository.updateBy).toHaveBeenCalledWith({ id: "entry-1", status: "waiting" }, { status: "left", endedAt: new Date(NOW) }, { returning: true });
    });

    it("answers 404 when no waiting entry of the caller has the id", async () => {
      const { service, repository } = setup();
      repository.updateBy.mockImplementation(vi.fn().mockResolvedValue(undefined));

      await expect(service.leave("entry-1")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("keep", () => {
    it("clears a pending question and schedules the next one 30 days out", async () => {
      const kept = anEntry({ stillWantedAskedAt: null });
      const { service, repository, jobQueueService } = setup({ placeInLine: 2 });
      repository.clearPendingStillWantedQuestion.mockResolvedValue(kept);

      const entry = await service.keep("entry-1");

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new AskStillWanted({ entryId: "entry-1" }), { startAfter: new Date(NOW + 30 * DAY_MS) });
      expect(entry).toMatchObject({ id: "entry-1", placeInLine: 2 });
    });

    it("returns the entry without scheduling anything when no question was pending", async () => {
      const waiting = anEntry();
      const { service, repository, jobQueueService } = setup();
      repository.clearPendingStillWantedQuestion.mockResolvedValue(undefined);
      repository.findWaitingById.mockResolvedValue(waiting);

      const entry = await service.keep("entry-1");

      expect(entry).toMatchObject({ id: "entry-1" });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("answers 404 and schedules nothing when no waiting entry of the caller has the id", async () => {
      const { service, repository, jobQueueService } = setup();
      repository.clearPendingStillWantedQuestion.mockResolvedValue(undefined);
      repository.findWaitingById.mockResolvedValue(undefined);

      await expect(service.keep("entry-1")).rejects.toMatchObject({ status: 404 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  function setup(input: { existing?: GpuWaitlistEntryRow; waitingCount?: number; joinTimes?: Date[]; placeInLine?: number } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const repository = mock<GpuWaitlistEntryRepository>();
    repository.accessibleBy.mockReturnValue(repository);
    repository.unscoped.mockReturnValue(repository);
    repository.findWaitingInPoolOf.mockResolvedValue(input.existing);
    repository.countWaitingAcrossOrganizations.mockResolvedValue(input.waitingCount ?? 0);
    repository.findJoinTimesAcrossOrganizationsSince.mockResolvedValue(input.joinTimes ?? []);
    repository.findPlaceInLineAcrossOrganizations.mockResolvedValue(input.placeInLine ?? 1);
    repository.create.mockImplementation(async values => anEntry({ ...values, userId: user.id }));
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();
    const config = mock<GpuWaitlistConfig>({
      GPU_WAITLIST_MAX_ACTIVE_ENTRIES: 10,
      GPU_WAITLIST_JOIN_HOURLY_LIMIT: 10,
      GPU_WAITLIST_JOIN_DAILY_LIMIT: 30,
      GPU_WAITLIST_STILL_WANTED_DAYS: 30
    });

    const service = new GpuWaitlistService(repository, userRepository, authService, txService, jobQueueService, config);

    return { service, repository, userRepository, authService, jobQueueService, user };
  }
});
