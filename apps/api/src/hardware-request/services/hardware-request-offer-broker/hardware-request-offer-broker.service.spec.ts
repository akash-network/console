import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestOfferStatus, HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { HardwareRequestBrokerService } from "@src/hardware-request/services/hardware-request-broker/hardware-request-broker.service";
import { HardwareRequestFunnelJob } from "@src/hardware-request/services/hardware-request-funnel/hardware-request-funnel.handler";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { AuditorService } from "@src/provider/services/auditors/auditors.service";
import { HardwareRequestOfferBrokerService, type HardwareRequestOfferDraft } from "./hardware-request-offer-broker.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createProviderWithAttributeSignatures } from "@test/seeders/provider.seeder";

const AUDITOR_ADDRESS = "akash1auditor";

describe(HardwareRequestOfferBrokerService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("drafts the offer with the provider's audit and uptime as they stand", async () => {
      const { service, hardwareRequestRepository, hardwareRequestOfferRepository, providerRepository, hardwareRequest, provider, draft } = setup();

      await service.create(hardwareRequest.id, draft);

      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(providerRepository.getWithAttributesAndAuditors).toHaveBeenCalledWith({ addresses: [provider.owner] });
      expect(hardwareRequestOfferRepository.create).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        providerAddress: provider.owner,
        providerAudited: true,
        providerUptime7d: 0.98,
        usdPerGpuHour: 2.4,
        terms: draft.terms,
        expiresAt: new Date(draft.expiresAt)
      });
    });

    it("marks a provider no known auditor signed for as unaudited, and a missing uptime as unknown", async () => {
      const { service, hardwareRequestOfferRepository, providerRepository, hardwareRequest, draft } = setup();
      const provider = createProviderWithAttributeSignatures("akash1stranger");
      provider.uptime7d = undefined;
      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider]);

      await service.create(hardwareRequest.id, { ...draft, providerAddress: provider.owner });

      expect(hardwareRequestOfferRepository.create).toHaveBeenCalledWith(expect.objectContaining({ providerAudited: false, providerUptime7d: null }));
    });

    it("counts a provider as audited when any of its signatures comes from a known auditor", async () => {
      const { service, hardwareRequestOfferRepository, providerRepository, hardwareRequest, provider, draft } = setup();
      const strangerSignature = createProviderWithAttributeSignatures("akash1stranger").providerAttributeSignatures[0];
      provider.providerAttributeSignatures = [...provider.providerAttributeSignatures, strangerSignature];
      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider]);

      await service.create(hardwareRequest.id, draft);

      expect(hardwareRequestOfferRepository.create).toHaveBeenCalledWith(expect.objectContaining({ providerAudited: true }));
    });

    it("answers 404 for an unknown request", async () => {
      const { service, hardwareRequestRepository, hardwareRequestOfferRepository, draft } = setup();
      hardwareRequestRepository.findById.mockResolvedValue(undefined);

      await expect(service.create("missing", draft)).rejects.toMatchObject({ status: 404, message: "Hardware request not found" });
      expect(hardwareRequestOfferRepository.create).not.toHaveBeenCalled();
    });

    it("answers 422 for an address no provider has", async () => {
      const { service, providerRepository, hardwareRequestOfferRepository, hardwareRequest, draft } = setup();
      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([]);

      await expect(service.create(hardwareRequest.id, draft)).rejects.toMatchObject({ status: 422, message: "No provider has this address" });
      expect(hardwareRequestOfferRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it.each(["draft", "published"] as const)("rewrites a %s offer under a row lock", async status => {
      const { service, hardwareRequestOfferRepository, txService, hardwareRequest, draft } = setup({ status });

      await service.update(hardwareRequest.id, "offer-1", { ...draft, usdPerGpuHour: 2.1 });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(hardwareRequestOfferRepository.findOneByAndLock).toHaveBeenCalledWith({ id: "offer-1", hardwareRequestId: hardwareRequest.id });
      expect(hardwareRequestOfferRepository.updateById).toHaveBeenCalledWith(
        "offer-1",
        expect.objectContaining({ usdPerGpuHour: 2.1, providerAudited: true, updatedAt: expect.any(Date) }),
        { returning: true }
      );
    });

    it.each(["withdrawn", "accepted", "declined", "closed"] as const)("answers 409 for a %s offer", async status => {
      const { service, hardwareRequestOfferRepository, hardwareRequest, draft } = setup({ status });

      await expect(service.update(hardwareRequest.id, "offer-1", draft)).rejects.toMatchObject({
        status: 409,
        message: `A ${status} offer can no longer change`
      });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
    });

    it("answers 404 for an offer of another request", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequest, draft } = setup();
      hardwareRequestOfferRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.update(hardwareRequest.id, "offer-1", draft)).rejects.toMatchObject({ status: 404, message: "Offer not found" });
    });
  });

  describe("publish", () => {
    it("shows a draft to the tenant, records who did, and moves the request to offers under its row lock", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-04T12:00:00.000Z"), toFake: ["Date"] });
      const {
        service,
        hardwareRequestRepository,
        hardwareRequestOfferRepository,
        hardwareRequestEventRepository,
        hardwareRequestBrokerService,
        jobQueueService,
        hardwareRequest
      } = setup();

      await service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(hardwareRequestRepository.findOneByAndLock).toHaveBeenCalledWith({ id: hardwareRequest.id });
      expect(hardwareRequestOfferRepository.updateById).toHaveBeenCalledWith(
        "offer-1",
        { status: "published", publishedAt: expect.any(Date), updatedAt: expect.any(Date) },
        { returning: true }
      );
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        type: "offer_published",
        actor: "Remington",
        payload: { offerId: "offer-1" }
      });
      expect(hardwareRequestBrokerService.moveLockedToStatus).toHaveBeenCalledWith(hardwareRequest, { actor: "Remington", status: "offers" });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new HardwareRequestFunnelJob({
          hardwareRequestId: hardwareRequest.id,
          step: "gpu_request_offer_published",
          stepKey: "offer-1",
          occurredAt: "2026-11-04T12:00:00.000Z",
          properties: { offerId: "offer-1", usdPerGpuHour: 2.4 }
        })
      );
    });

    it("leaves an offer that is already published as it is", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequestBrokerService, jobQueueService, hardwareRequest } = setup({ status: "published" });

      await service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestBrokerService.moveLockedToStatus).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it.each(["withdrawn", "accepted", "declined", "closed"] as const)("answers 409 for a %s offer", async status => {
      const { service, hardwareRequest } = setup({ status });

      await expect(service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" })).rejects.toMatchObject({
        status: 409,
        message: `A ${status} offer can't be published`
      });
    });

    it("answers 409 for an offer that has expired", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequest } = setup({ expiresAt: new Date(Date.now() - 1000).toISOString() });

      await expect(service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" })).rejects.toMatchObject({
        status: 409,
        message: "An expired offer can't be published"
      });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
    });

    it("answers 409 for an offer that expires at this very moment", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-04T12:00:00.000Z"), toFake: ["Date"] });
      const { service, hardwareRequest } = setup({ expiresAt: "2026-11-04T12:00:00.000Z" });

      await expect(service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" })).rejects.toMatchObject({ status: 409 });
    });

    it.each(["accepted", "fulfilled", "withdrawn", "closed"] as const)("answers 409 on a %s request", async requestStatus => {
      const { service, hardwareRequestOfferRepository, hardwareRequest } = setup({ requestStatus });

      await expect(service.publish(hardwareRequest.id, "offer-1", { actor: "Remington" })).rejects.toMatchObject({
        status: 409,
        message: `A ${requestStatus} request takes no new offers`
      });
      expect(hardwareRequestOfferRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown request", async () => {
      const { service, hardwareRequestRepository } = setup();
      hardwareRequestRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.publish("missing", "offer-1", { actor: "Remington" })).rejects.toMatchObject({ status: 404, message: "Hardware request not found" });
    });
  });

  describe("withdraw", () => {
    it.each(["draft", "published"] as const)("withdraws a %s offer and records who did", async status => {
      const { service, hardwareRequestOfferRepository, hardwareRequestEventRepository, hardwareRequest } = setup({ status });

      await service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestOfferRepository.updateById).toHaveBeenCalledWith(
        "offer-1",
        { status: "withdrawn", updatedAt: expect.any(Date) },
        { returning: true }
      );
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: hardwareRequest.id,
        type: "offer_withdrawn",
        actor: "Remington",
        payload: { offerId: "offer-1" }
      });
    });

    it("takes a request with offers back to sourcing under its row lock once no published offer is left", async () => {
      const { service, hardwareRequestRepository, hardwareRequestOfferRepository, hardwareRequestBrokerService, hardwareRequest } = setup({
        status: "published",
        requestStatus: "offers",
        publishedOffersLeft: 0
      });

      await service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(hardwareRequestRepository.findOneByAndLock).toHaveBeenCalledWith({ id: hardwareRequest.id });
      expect(hardwareRequestOfferRepository.count).toHaveBeenCalledWith({ hardwareRequestId: hardwareRequest.id, status: "published" });
      expect(hardwareRequestBrokerService.moveLockedToStatus).toHaveBeenCalledWith(hardwareRequest, { actor: "Remington", status: "sourcing" });
    });

    it("keeps a request with offers as it is while another published offer is left", async () => {
      const { service, hardwareRequestBrokerService, hardwareRequest } = setup({ status: "published", requestStatus: "offers", publishedOffersLeft: 1 });

      await service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestBrokerService.moveLockedToStatus).not.toHaveBeenCalled();
    });

    it.each(["submitted", "in_review", "sourcing"] as const)("keeps a %s request as it is when its last offer is withdrawn", async requestStatus => {
      const { service, hardwareRequestBrokerService, hardwareRequest } = setup({ status: "draft", requestStatus, publishedOffersLeft: 0 });

      await service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestBrokerService.moveLockedToStatus).not.toHaveBeenCalled();
    });

    it("leaves an offer that is already withdrawn as it is", async () => {
      const { service, hardwareRequestOfferRepository, hardwareRequestEventRepository, hardwareRequestBrokerService, hardwareRequest } = setup({
        status: "withdrawn",
        requestStatus: "offers",
        publishedOffersLeft: 0
      });

      await service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" });

      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
      expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
      expect(hardwareRequestBrokerService.moveLockedToStatus).not.toHaveBeenCalled();
    });

    it("answers 404 for an unknown request", async () => {
      const { service, hardwareRequestRepository, hardwareRequestOfferRepository } = setup();
      hardwareRequestRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.withdraw("missing", "offer-1", { actor: "Remington" })).rejects.toMatchObject({
        status: 404,
        message: "Hardware request not found"
      });
      expect(hardwareRequestOfferRepository.updateById).not.toHaveBeenCalled();
    });

    it.each(["accepted", "declined", "closed"] as const)("answers 409 for a %s offer", async status => {
      const { service, hardwareRequest } = setup({ status });

      await expect(service.withdraw(hardwareRequest.id, "offer-1", { actor: "Remington" })).rejects.toMatchObject({
        status: 409,
        message: `A ${status} offer can't be withdrawn`
      });
    });
  });

  function setup(input: { status?: HardwareRequestOfferStatus; expiresAt?: string; requestStatus?: HardwareRequestStatus; publishedOffersLeft?: number } = {}) {
    const hardwareRequest = createHardwareRequest({ status: input.requestStatus ?? "sourcing" });
    const provider = createProviderWithAttributeSignatures(AUDITOR_ADDRESS);
    provider.uptime7d = 0.98;
    const draft: HardwareRequestOfferDraft = {
      providerAddress: provider.owner,
      usdPerGpuHour: 2.4,
      terms: {
        gpu: { model: "H200", count: 16, interconnect: "cluster" },
        location: "Frankfurt, DE",
        availableFrom: "2026-12-01",
        term: "6_months",
        sla: "99.9",
        storage: { tbPerNode: 8, nvme: true },
        uplinkGbps: 10
      },
      expiresAt: "2026-12-15T00:00:00.000Z"
    };
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    hardwareRequestRepository.findOneByAndLock.mockResolvedValue(hardwareRequest);
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findOneByAndLock.mockResolvedValue(
      mock<HardwareRequestOfferOutput>({
        id: "offer-1",
        usdPerGpuHour: 2.4,
        status: input.status ?? "draft",
        expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000).toISOString()
      })
    );
    hardwareRequestOfferRepository.count.mockResolvedValue(input.publishedOffersLeft ?? 0);
    const providerRepository = mock<ProviderRepository>();
    providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider]);
    const auditorService = mock<AuditorService>();
    auditorService.getAuditors.mockResolvedValue([{ id: "akash-network", name: "Akash Network", address: AUDITOR_ADDRESS, website: "https://akash.network" }]);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const hardwareRequestEventRepository = mock<HardwareRequestEventRepository>();
    const hardwareRequestBrokerService = mock<HardwareRequestBrokerService>();
    const jobQueueService = mock<JobQueueService>();
    const service = new HardwareRequestOfferBrokerService(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      providerRepository,
      auditorService,
      txService,
      hardwareRequestEventRepository,
      hardwareRequestBrokerService,
      jobQueueService
    );

    return {
      service,
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      hardwareRequestEventRepository,
      hardwareRequestBrokerService,
      jobQueueService,
      providerRepository,
      txService,
      hardwareRequest,
      provider,
      draft
    };
  }
});
