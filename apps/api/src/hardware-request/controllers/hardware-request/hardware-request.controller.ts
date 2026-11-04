import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateHardwareRequestRequest,
  CreateHardwareRequestResponse,
  HardwareRequestResponse,
  ListHardwareRequestOffersResponse,
  ListHardwareRequestsResponse,
  TenantHardwareRequestOfferResponse
} from "@src/hardware-request/http-schemas/hardware-request.schema";
import { toTenantOffer } from "@src/hardware-request/lib/hardware-request-tenant-offer/hardware-request-tenant-offer";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestService } from "@src/hardware-request/services/hardware-request/hardware-request.service";
import { HardwareRequestOfferDecisionService } from "@src/hardware-request/services/hardware-request-offer-decision/hardware-request-offer-decision.service";

/** Lists only what the tenant may see, so routing and ownership columns added for the team stay internal. */
function toTenantView(hardwareRequest: HardwareRequestOutput): ListHardwareRequestsResponse["data"][number] {
  const { id, userId, organizationId, category, status, source, gpuModel, quantity, region, details, contactEmail, spec, createdAt, updatedAt } =
    hardwareRequest;

  return { id, userId, organizationId, category, status, source, gpuModel, quantity, region, details, contactEmail, spec, createdAt, updatedAt };
}

@singleton()
export class HardwareRequestController {
  constructor(
    private readonly hardwareRequestService: HardwareRequestService,
    private readonly hardwareRequestOfferDecisionService: HardwareRequestOfferDecisionService
  ) {}

  @Protected([{ action: "create", subject: "HardwareRequest" }])
  async create(input: CreateHardwareRequestRequest["data"]): Promise<CreateHardwareRequestResponse> {
    const { id, createdAt, lane } = await this.hardwareRequestService.create(input);
    return { data: { id, createdAt, lane } };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async list(): Promise<ListHardwareRequestsResponse> {
    const hardwareRequests = await this.hardwareRequestService.list();
    return { data: hardwareRequests.map(toTenantView) };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async withdraw(hardwareRequestId: string): Promise<HardwareRequestResponse> {
    return { data: toTenantView(await this.hardwareRequestService.withdraw(hardwareRequestId)) };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async acceptOffer(hardwareRequestId: string, offerId: string): Promise<TenantHardwareRequestOfferResponse> {
    return { data: toTenantOffer(await this.hardwareRequestOfferDecisionService.accept(hardwareRequestId, offerId), new Date()) };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async declineOffer(hardwareRequestId: string, offerId: string): Promise<TenantHardwareRequestOfferResponse> {
    return { data: toTenantOffer(await this.hardwareRequestOfferDecisionService.decline(hardwareRequestId, offerId), new Date()) };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async requestOfferApproval(hardwareRequestId: string, offerId: string): Promise<TenantHardwareRequestOfferResponse> {
    return { data: toTenantOffer(await this.hardwareRequestOfferDecisionService.requestApproval(hardwareRequestId, offerId), new Date()) };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async listOffers(hardwareRequestId: string): Promise<ListHardwareRequestOffersResponse> {
    const offers = await this.hardwareRequestService.listOffers(hardwareRequestId);
    const now = new Date();

    return { data: offers.map(offer => toTenantOffer(offer, now)) };
  }
}
