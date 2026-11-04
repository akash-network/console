import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestOfferStatus } from "@src/hardware-request/model-schemas";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { AuditorService } from "@src/provider/services/auditors/auditors.service";
import { HardwareRequestOfferBrokerService, type HardwareRequestOfferDraft } from "./hardware-request-offer-broker.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";
import { createProviderWithAttributeSignatures } from "@test/seeders/provider.seeder";

const AUDITOR_ADDRESS = "akash1auditor";

describe(HardwareRequestOfferBrokerService.name, () => {
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

  function setup(input: { status?: HardwareRequestOfferStatus } = {}) {
    const hardwareRequest = createHardwareRequest();
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
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findOneByAndLock.mockResolvedValue(mock<HardwareRequestOfferOutput>({ id: "offer-1", status: input.status ?? "draft" }));
    const providerRepository = mock<ProviderRepository>();
    providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider]);
    const auditorService = mock<AuditorService>();
    auditorService.getAuditors.mockResolvedValue([{ id: "akash-network", name: "Akash Network", address: AUDITOR_ADDRESS, website: "https://akash.network" }]);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const service = new HardwareRequestOfferBrokerService(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      providerRepository,
      auditorService,
      txService
    );

    return { service, hardwareRequestRepository, hardwareRequestOfferRepository, providerRepository, txService, hardwareRequest, provider, draft };
  }
});
