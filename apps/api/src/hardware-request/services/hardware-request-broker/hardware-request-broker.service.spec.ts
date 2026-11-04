import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type {
  HardwareRequestOutput,
  HardwareRequestQueueFilters,
  HardwareRequestRepository,
  QueuedHardwareRequest
} from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestEventOutput,
  HardwareRequestEventRepository
} from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestStatusNotificationJob } from "@src/hardware-request/services/hardware-request-status-notification/hardware-request-status-notification.handler";
import { HardwareRequestBrokerService } from "./hardware-request-broker.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(HardwareRequestBrokerService.name, () => {
  describe("listQueue", () => {
    it("reads the queue across organizations with the filters it is given", async () => {
      const { service, hardwareRequestRepository, queued } = setup();
      const filters: HardwareRequestQueueFilters = { lane: "sales", order: "oldest", limit: 10, offset: 20 };

      await expect(service.listQueue(filters)).resolves.toEqual([queued]);
      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(hardwareRequestRepository.findQueue).toHaveBeenCalledWith(filters);
    });
  });

  describe("getWithTimeline", () => {
    it("returns the request with its events", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, hardwareRequestOfferRepository, queued, events, offers } = setup();

      await expect(service.getWithTimeline(queued.id)).resolves.toEqual({ ...queued, events, offers });
      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(hardwareRequestRepository.findQueuedById).toHaveBeenCalledWith(queued.id);
      expect(hardwareRequestEventRepository.findOldestFirst).toHaveBeenCalledWith(queued.id);
      expect(hardwareRequestOfferRepository.findOldestFirst).toHaveBeenCalledWith(queued.id);
    });

    it("answers 404 for an unknown request", async () => {
      const { service, hardwareRequestRepository } = setup();
      hardwareRequestRepository.findQueuedById.mockResolvedValue(undefined);

      await expect(service.getWithTimeline("missing")).rejects.toMatchObject({ status: 404, message: "Hardware request not found" });
    });
  });

  describe("assignOwner", () => {
    it("records the new owner and returns the request with its timeline", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, txService, locked, queued, events, offers } = setup({ owner: null });

      await expect(service.assignOwner(locked.id, { actor: "Remington", owner: "Remington" })).resolves.toEqual({ ...queued, events, offers });
      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(hardwareRequestRepository.findOneByAndLock).toHaveBeenCalledWith({ id: locked.id });
      expect(hardwareRequestRepository.updateById).toHaveBeenCalledWith(locked.id, { owner: "Remington", updatedAt: expect.any(Date) });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: locked.id,
        type: "owner_changed",
        actor: "Remington",
        payload: { from: null, to: "Remington" }
      });
    });

    it("records nothing when the request already has that owner", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, locked } = setup({ owner: "Remington" });

      await service.assignOwner(locked.id, { actor: "Remington", owner: "Remington" });

      expect(hardwareRequestRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown request without writing", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository } = setup();
      hardwareRequestRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.assignOwner("missing", { actor: "Remington", owner: null })).rejects.toMatchObject({ status: 404 });
      expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
    });
  });

  describe("switchLane", () => {
    it("moves the request to the other lane by hand", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, locked } = setup({ lane: "automated" });

      await service.switchLane(locked.id, { actor: "Remington", lane: "sales" });

      expect(hardwareRequestRepository.updateById).toHaveBeenCalledWith(locked.id, { lane: "sales", laneReason: "manual", updatedAt: expect.any(Date) });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: locked.id,
        type: "lane_changed",
        actor: "Remington",
        payload: { from: "automated", to: "sales" }
      });
    });

    it("records nothing when the request is already in that lane", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, locked } = setup({ lane: "sales" });

      await service.switchLane(locked.id, { actor: "Remington", lane: "sales" });

      expect(hardwareRequestRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
    });
  });

  describe("changeStatus", () => {
    it("moves the request, dates its first reply and tells the tenant in the same transaction", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, jobQueueService, txService, locked } = setup({
        status: "submitted",
        firstRepliedAt: null
      });

      await service.changeStatus(locked.id, { actor: "Remington", status: "sourcing" });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(hardwareRequestRepository.updateById).toHaveBeenCalledWith(locked.id, {
        status: "sourcing",
        updatedAt: expect.any(Date),
        firstRepliedAt: expect.any(Date)
      });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: locked.id,
        type: "status_changed",
        actor: "Remington",
        payload: { from: "submitted", to: "sourcing" }
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new HardwareRequestStatusNotificationJob({ hardwareRequestId: locked.id, eventId: "recorded-event", status: "sourcing", closeReason: undefined })
      );
    });

    it("keeps the first reply of a request already answered", async () => {
      const { service, hardwareRequestRepository, locked } = setup({ status: "in_review", firstRepliedAt: "2026-11-01T00:00:00.000Z" });

      await service.changeStatus(locked.id, { actor: "Remington", status: "sourcing" });

      expect(hardwareRequestRepository.updateById).toHaveBeenCalledWith(locked.id, { status: "sourcing", updatedAt: expect.any(Date) });
    });

    it("records why a request was closed", async () => {
      const { service, hardwareRequestEventRepository, jobQueueService, locked } = setup({ status: "sourcing" });

      await service.changeStatus(locked.id, { actor: "Remington", status: "closed", closeReason: "no_supply" });

      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { from: "sourcing", to: "closed", closeReason: "no_supply" } })
      );
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new HardwareRequestStatusNotificationJob({ hardwareRequestId: locked.id, eventId: "recorded-event", status: "closed", closeReason: "no_supply" })
      );
    });

    it("neither records nor notifies when the request already has that status", async () => {
      const { service, hardwareRequestRepository, jobQueueService, locked } = setup({ status: "sourcing" });

      await service.changeStatus(locked.id, { actor: "Remington", status: "sourcing" });

      expect(hardwareRequestRepository.updateById).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("addNote", () => {
    it("records the note without touching the request", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, locked, queued, events, offers } = setup();

      await expect(service.addNote(locked.id, { actor: "Remington", text: "Called them" })).resolves.toEqual({ ...queued, events, offers });
      expect(hardwareRequestRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: locked.id,
        type: "note",
        actor: "Remington",
        payload: { text: "Called them" }
      });
    });
  });

  function setup(input: Partial<Pick<HardwareRequestOutput, "owner" | "lane" | "status" | "firstRepliedAt">> = {}) {
    const locked = createHardwareRequest(input);
    const queued: QueuedHardwareRequest = { ...locked, organizationName: "Acme", lastRepliedAt: null };
    const events = [mock<HardwareRequestEventOutput>({ id: "event-1" })];
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findQueue.mockResolvedValue([queued]);
    hardwareRequestRepository.findQueuedById.mockResolvedValue(queued);
    hardwareRequestRepository.findOneByAndLock.mockResolvedValue(locked);
    const hardwareRequestEventRepository = mock<HardwareRequestEventRepository>();
    hardwareRequestEventRepository.findOldestFirst.mockResolvedValue(events);
    hardwareRequestEventRepository.record.mockResolvedValue(mock<HardwareRequestEventOutput>({ id: "recorded-event" }));
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();
    const offers = [mock<HardwareRequestOfferOutput>({ id: "offer-1" })];
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findOldestFirst.mockResolvedValue(offers);
    const service = new HardwareRequestBrokerService(
      hardwareRequestRepository,
      hardwareRequestEventRepository,
      txService,
      jobQueueService,
      hardwareRequestOfferRepository
    );

    return {
      service,
      hardwareRequestRepository,
      hardwareRequestEventRepository,
      hardwareRequestOfferRepository,
      txService,
      jobQueueService,
      locked,
      queued,
      events,
      offers
    };
  }
});
