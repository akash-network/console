import createError from "http-errors";
import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { CloseReason, HardwareRequestLane, HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import {
  type HardwareRequestOutput,
  type HardwareRequestQueueFilters,
  HardwareRequestRepository,
  type QueuedHardwareRequest
} from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import {
  type HardwareRequestEventOutput,
  HardwareRequestEventRepository
} from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestStatusNotificationJob } from "@src/hardware-request/services/hardware-request-status-notification/hardware-request-status-notification.handler";

export type HardwareRequestWithTimeline = QueuedHardwareRequest & { events: HardwareRequestEventOutput[] };

/** Serves the team's broker queue, which sees every organization's requests. */
@singleton()
export class HardwareRequestBrokerService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestEventRepository: HardwareRequestEventRepository,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService
  ) {}

  async listQueue(filters: HardwareRequestQueueFilters): Promise<QueuedHardwareRequest[]> {
    return await this.#requests.findQueue(filters);
  }

  async getWithTimeline(id: string): Promise<HardwareRequestWithTimeline> {
    const hardwareRequest = await this.#requests.findQueuedById(id);

    if (!hardwareRequest) throw createError(404, "Hardware request not found");

    return { ...hardwareRequest, events: await this.hardwareRequestEventRepository.findOldestFirst(id) };
  }

  /** Claims, reassigns or releases a request; assigning the owner it already has records nothing. */
  async assignOwner(id: string, { actor, owner }: { actor: string; owner: string | null }): Promise<HardwareRequestWithTimeline> {
    await this.#changeLocked(id, async hardwareRequest => {
      if (hardwareRequest.owner === owner) return;

      await this.#requests.updateById(id, { owner, updatedAt: new Date() });
      await this.hardwareRequestEventRepository.record({
        hardwareRequestId: id,
        type: "owner_changed",
        actor,
        payload: { from: hardwareRequest.owner, to: owner }
      });
    });

    return await this.getWithTimeline(id);
  }

  async switchLane(id: string, { actor, lane }: { actor: string; lane: HardwareRequestLane }): Promise<HardwareRequestWithTimeline> {
    await this.#changeLocked(id, async hardwareRequest => {
      if (hardwareRequest.lane === lane) return;

      await this.#requests.updateById(id, { lane, laneReason: "manual", updatedAt: new Date() });
      await this.hardwareRequestEventRepository.record({
        hardwareRequestId: id,
        type: "lane_changed",
        actor,
        payload: { from: hardwareRequest.lane, to: lane }
      });
    });

    return await this.getWithTimeline(id);
  }

  /** Tells the tenant in the same transaction, and counts as the team's first reply when none came before. */
  async changeStatus(
    id: string,
    { actor, status, closeReason }: { actor: string; status: HardwareRequestStatus; closeReason?: CloseReason }
  ): Promise<HardwareRequestWithTimeline> {
    await this.#changeLocked(id, async hardwareRequest => {
      if (hardwareRequest.status === status) return;

      const now = new Date();
      await this.#requests.updateById(id, { status, updatedAt: now, ...(hardwareRequest.firstRepliedAt ? {} : { firstRepliedAt: now }) });
      const event = await this.hardwareRequestEventRepository.record({
        hardwareRequestId: id,
        type: "status_changed",
        actor,
        payload: { from: hardwareRequest.status, to: status, ...(closeReason && { closeReason }) }
      });
      await this.jobQueueService.enqueue(new HardwareRequestStatusNotificationJob({ hardwareRequestId: id, eventId: event.id, status, closeReason }));
    });

    return await this.getWithTimeline(id);
  }

  async addNote(id: string, { actor, text }: { actor: string; text: string }): Promise<HardwareRequestWithTimeline> {
    await this.#changeLocked(id, async () => {
      await this.hardwareRequestEventRepository.record({ hardwareRequestId: id, type: "note", actor, payload: { text } });
    });

    return await this.getWithTimeline(id);
  }

  get #requests() {
    return this.hardwareRequestRepository.unscoped("gpu-request-broker");
  }

  async #changeLocked(id: string, change: (hardwareRequest: HardwareRequestOutput) => Promise<void>): Promise<void> {
    await this.txService.transaction(async () => {
      const hardwareRequest = await this.#requests.findOneByAndLock({ id });

      if (!hardwareRequest) throw createError(404, "Hardware request not found");

      await change(hardwareRequest);
    });
  }
}
