import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseGpuOfferService } from "@src/deployment/services/lease-gpu-offer/lease-gpu-offer.service";
import type { GpuWaitlistFulfilmentService } from "@src/gpu-waitlist/services/gpu-waitlist-fulfilment/gpu-waitlist-fulfilment.service";
import { RecordLeaseGpuOffersHandler } from "./record-lease-gpu-offers.handler";

const OFFER = {
  gseq: 1,
  oseq: 1,
  provider: "akash1provider",
  bseq: 0,
  resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 8, attributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" }] }],
  recordedAt: "2026-11-18T12:00:00.000Z"
};

describe(RecordLeaseGpuOffersHandler.name, () => {
  it("fulfils the waitlist entries of the wallet's account for the leased gpu models", async () => {
    const { handler, fulfilmentService } = setup({});

    await handler.handle({ walletId: 1, dseq: "100", version: 1 });

    expect(fulfilmentService.fulfilForOffers).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId: "org-1",
      offers: [{ vendor: "nvidia", model: "a100", ram: "80Gi", interface: "sxm", count: 8 }]
    });
  });

  it("records the offers and logs the failure when fulfilment throws, instead of failing the job", async () => {
    const { handler, fulfilmentService, deploymentSettingRepository, logger } = setup({});
    const error = new Error("database down");
    fulfilmentService.fulfilForOffers.mockRejectedValue(error);

    await expect(handler.handle({ walletId: 1, dseq: "100", version: 1 })).resolves.toBeUndefined();

    expect(deploymentSettingRepository.mergeGpuOffers).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_WAITLIST_FULFILMENT_FAILED", dseq: "100", error }));
  });

  it("fulfils nothing for a lease with no gpu offers", async () => {
    const { handler, fulfilmentService } = setup({ offers: [] });

    await handler.handle({ walletId: 1, dseq: "100", version: 1 });

    expect(fulfilmentService.fulfilForOffers).not.toHaveBeenCalled();
  });

  function setup(input: { offers?: (typeof OFFER)[] }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneBy.mockResolvedValue(mock<UserWalletOutput>({ id: 1, address: "akash1owner", userId: "user-1", organizationId: "org-1" }));
    const offerService = mock<LeaseGpuOfferService>();
    offerService.findOffers.mockResolvedValue({ liveLeases: 1, offers: input.offers ?? [OFFER] });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.mergeGpuOffers.mockResolvedValue(true);
    const fulfilmentService = mock<GpuWaitlistFulfilmentService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new RecordLeaseGpuOffersHandler(userWalletRepository, offerService, deploymentSettingRepository, fulfilmentService, () => logger);

    return { handler, fulfilmentService, deploymentSettingRepository, logger };
  }
});
