import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestInput } from "@src/hardware-request/http-schemas/hardware-request.schema";
import { describeSpecRegion } from "@src/hardware-request/lib/hardware-request-spec-summary/hardware-request-spec-summary";
import { isVisibleToTenant, type TenantVisibleOffer } from "@src/hardware-request/lib/hardware-request-tenant-offer/hardware-request-tenant-offer";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { type HardwareRequestOutput, HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { GpuRequestRoutingService, type RoutedLane } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { HardwareRequestSlackAlertJob } from "@src/hardware-request/services/hardware-request-slack-alert/hardware-request-slack-alert.handler";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { UserRepository } from "@src/user/repositories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type RequestWindow = { durationMs: number; limit: number; message: string };

type Refusal = { message: string; retryAfterSeconds: number };

type Requester = { userId: string | null; organizationId: string | null };

export type HardwareRequestOnBehalfInput = { actor: string; organizationId?: string; request: HardwareRequestInput };

type HardwareRequestRepositoryCursor = Pick<HardwareRequestRepository, "create">;

/** Waits on the request `limit` places before the newest, since a window a lowered limit left over-full needs more than its oldest to leave. */
function refusalIn({ durationMs, limit, message }: RequestWindow, creationTimes: Date[], now: number): Refusal | undefined {
  const windowStart = now - durationMs;
  const inWindow = creationTimes.filter(createdAt => createdAt.getTime() > windowStart);

  if (inWindow.length < limit) return undefined;

  const releasing = inWindow[inWindow.length - limit];
  return { message, retryAfterSeconds: Math.ceil((releasing.getTime() - windowStart) / 1000) };
}

/** Quote requests also fill the flat columns, so demand reporting groups them with the older request types. */
function summaryColumnsOf(input: HardwareRequestInput) {
  if (input.category !== "quote") return {};

  return { gpuModel: input.spec.gpu.model, quantity: input.spec.gpu.count, region: describeSpecRegion(input.spec) };
}

function laneRoutedRequestOf(input: HardwareRequestInput) {
  if (input.category === "quote") return { spec: input.spec, gpuModel: null, quantity: null };
  if (input.category === "gpu_model" || input.category === "capacity") return { spec: null, gpuModel: input.gpuModel ?? null, quantity: input.quantity };

  return { spec: null, gpuModel: null, quantity: null };
}

@singleton()
export class HardwareRequestService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    private readonly gpuRequestRoutingService: GpuRequestRoutingService,
    private readonly executionContextService: ExecutionContextService,
    private readonly hardwareRequestEventRepository: HardwareRequestEventRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig
  ) {}

  async create(input: HardwareRequestInput): Promise<HardwareRequestOutput & RoutedLane> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId });
      await this.#assertWithinLimits(userId);

      const organizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId ?? null;

      return await this.#file(this.hardwareRequestRepository.accessibleBy(this.authService.ability, "create"), input, { userId, organizationId });
    });
  }

  /** Files a request the team took offline, for an organization's oldest owner or for an email with no account yet, without the tenant's rate limits. */
  async createOnBehalf({ actor, organizationId, request }: HardwareRequestOnBehalfInput): Promise<HardwareRequestOutput & RoutedLane> {
    const requester = organizationId ? await this.#oldestOwnerOf(organizationId) : await this.#unclaimedRequester(request.email);

    return await this.txService.transaction(async () => {
      const hardwareRequest = await this.#file(this.hardwareRequestRepository.unscoped("gpu-request-broker"), request, requester);
      await this.hardwareRequestEventRepository.record({
        hardwareRequestId: hardwareRequest.id,
        type: "created_on_behalf",
        actor,
        payload: organizationId ? { organizationId, email: null } : { organizationId: null, email: request.email }
      });

      return hardwareRequest;
    });
  }

  async list(): Promise<HardwareRequestOutput[]> {
    return await this.hardwareRequestRepository.accessibleBy(this.authService.ability, "read").findNewestFirst();
  }

  async #file(repository: HardwareRequestRepositoryCursor, input: HardwareRequestInput, requester: Requester): Promise<HardwareRequestOutput & RoutedLane> {
    const { email, ...fields } = input;
    const routing = await this.gpuRequestRoutingService.route(laneRoutedRequestOf(input), requester);
    const hardwareRequest = await repository.create({ ...fields, ...summaryColumnsOf(input), ...routing, contactEmail: email, ...requester });
    await this.jobQueueService.enqueue(new HardwareRequestEmailJob({ hardwareRequestId: hardwareRequest.id }));
    await this.jobQueueService.enqueue(new HardwareRequestSlackAlertJob({ hardwareRequestId: hardwareRequest.id }));

    return { ...hardwareRequest, ...routing };
  }

  async #unclaimedRequester(email: string): Promise<Requester> {
    if (await this.userRepository.hasVerifiedEmail(email)) {
      throw createError(409, "An account already uses this email, so file the request for one of its organizations");
    }

    return { userId: null, organizationId: null };
  }

  async #oldestOwnerOf(organizationId: string): Promise<Requester> {
    const organization = await this.organizationRepository.findById(organizationId);

    if (!organization || organization.deletedAt) throw createError(404, "Organization not found");

    const members = await this.organizationMemberRepository.unscoped("gpu-request-broker").findAllWithUsers(organizationId);
    const owner = members.find(member => member.role === "owner");

    if (!owner) throw createError(422, "The organization has no owner to file the request for");

    return { userId: owner.userId, organizationId };
  }

  async listOffers(hardwareRequestId: string): Promise<TenantVisibleOffer[]> {
    const hardwareRequest = await this.hardwareRequestRepository.accessibleBy(this.authService.ability, "read").findById(hardwareRequestId);

    if (!hardwareRequest) throw createError(404, "Hardware request not found");

    const offers = await this.hardwareRequestOfferRepository.findOldestFirst(hardwareRequestId);

    return offers.filter(isVisibleToTenant);
  }

  /** A user over both limits is told the later of the two times, since either window can be the one that lifts last. */
  async #assertWithinLimits(userId: string): Promise<void> {
    const now = Date.now();
    const windows: RequestWindow[] = [
      {
        durationMs: DAY_MS,
        limit: this.config.HARDWARE_REQUEST_DAILY_LIMIT,
        message: `You can send up to ${this.config.HARDWARE_REQUEST_DAILY_LIMIT} requests a day. Try again later, or ask us on Discord.`
      },
      {
        durationMs: HOUR_MS,
        limit: this.config.HARDWARE_REQUEST_HOURLY_LIMIT,
        message: `You can send up to ${this.config.HARDWARE_REQUEST_HOURLY_LIMIT} requests an hour. Try again later, or ask us on Discord.`
      }
    ];
    const creationTimes = await this.hardwareRequestRepository.findCreationTimesSince(userId, new Date(now - DAY_MS));

    const refusals = windows.map(window => refusalIn(window, creationTimes, now)).filter(refusal => refusal !== undefined);

    if (refusals.length === 0) return;

    const latest = refusals.reduce((later, refusal) => (refusal.retryAfterSeconds > later.retryAfterSeconds ? refusal : later));
    throw createError(429, latest.message, { errorCode: "hardware_request_limit", headers: { "Retry-After": String(latest.retryAfterSeconds) } });
  }
}
