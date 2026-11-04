import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestConfig } from "@src/hardware-request/config/env.config";
import type { HardwareRequestInput } from "@src/hardware-request/http-schemas/hardware-request.schema";
import type { LaneRoutedRequest } from "@src/hardware-request/lib/hardware-request-lane/hardware-request-lane";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type {
  HardwareRequestEventOutput,
  HardwareRequestEventRepository
} from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import type { GpuRequestRoutingService, RoutedLane } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { HardwareRequestSlackAlertJob } from "@src/hardware-request/services/hardware-request-slack-alert/hardware-request-slack-alert.handler";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserRepository } from "@src/user/repositories";
import { HardwareRequestService } from "./hardware-request.service";

import { createHardwareRequest, createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";
import { createUser } from "@test/seeders/user.seeder";

const ROUTING: RoutedLane = { lane: "sales", laneReason: "monthly_value", estimatedMonthlyUsd: 35_040, owner: "Remington" };
const QUOTE_SPEC = createHardwareRequestSpec();

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
        userId: user.id,
        organizationId: null,
        ...ROUTING
      });
    });

    it("records a quote request with its spec and fills the GPU, quantity and region columns from it", async () => {
      const { service, hardwareRequestRepository, user } = setup();
      const spec = createHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "server" }, region: { mode: "except", areas: ["me"] } });

      await service.create({ category: "quote", spec, source: "reserve_capacity", email: "jane@example.com" });

      expect(hardwareRequestRepository.create).toHaveBeenCalledWith({
        category: "quote",
        spec,
        source: "reserve_capacity",
        gpuModel: "H200",
        quantity: 16,
        region: "Anywhere except Middle East",
        contactEmail: "jane@example.com",
        userId: user.id,
        organizationId: null,
        ...ROUTING
      });
    });

    it.each([
      { input: { category: "quote", spec: QUOTE_SPEC, email: "jane@example.com" }, routed: { spec: QUOTE_SPEC, gpuModel: null, quantity: null } },
      { input: { category: "gpu_model", gpuModel: "B200", quantity: 8, email: "jane@example.com" }, routed: { spec: null, gpuModel: "B200", quantity: 8 } },
      { input: { category: "capacity", quantity: 4, email: "jane@example.com" }, routed: { spec: null, gpuModel: null, quantity: 4 } },
      { input: { category: "region", region: "Frankfurt", email: "jane@example.com" }, routed: { spec: null, gpuModel: null, quantity: null } },
      { input: { category: "other", details: "ARM nodes", email: "jane@example.com" }, routed: { spec: null, gpuModel: null, quantity: null } }
    ] satisfies { input: HardwareRequestInput; routed: LaneRoutedRequest }[])(
      "routes a $input.category request by what it asks for, under the active organization",
      async ({ input, routed }) => {
        const { service, gpuRequestRoutingService, user } = setup({ organizationId: "org-1" });

        await service.create(input);

        expect(gpuRequestRoutingService.route).toHaveBeenCalledWith(routed, { userId: user.id, organizationId: "org-1" });
      }
    );

    it("routes the request without an organization outside organization context", async () => {
      const { service, gpuRequestRoutingService, user } = setup({ organizationId: undefined });

      await service.create(anInput());

      expect(gpuRequestRoutingService.route).toHaveBeenCalledWith(expect.anything(), { userId: user.id, organizationId: null });
    });

    it("creates the request through the current user's create ability", async () => {
      const { service, hardwareRequestRepository, authService } = setup();

      await service.create(anInput());

      expect(hardwareRequestRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
    });

    it("returns the created request", async () => {
      const { service, created } = setup();

      await expect(service.create(anInput())).resolves.toEqual({ ...created, ...ROUTING });
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

  describe("createOnBehalf", () => {
    it("files the request for the organization's oldest owner, routes and alerts it, and records who filed it", async () => {
      const {
        service,
        hardwareRequestRepository,
        hardwareRequestEventRepository,
        organizationMemberRepository,
        gpuRequestRoutingService,
        jobQueueService,
        created
      } = setup({
        members: [aMember({ userId: "admin-1", role: "admin" }), aMember({ userId: "owner-1", role: "owner" }), aMember({ userId: "owner-2", role: "owner" })]
      });

      await expect(service.createOnBehalf({ actor: "Remington", organizationId: "org-1", request: anInput() })).resolves.toEqual({ ...created, ...ROUTING });

      expect(organizationMemberRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(organizationMemberRepository.findAllWithUsers).toHaveBeenCalledWith("org-1");
      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(gpuRequestRoutingService.route).toHaveBeenCalledWith(expect.anything(), { userId: "owner-1", organizationId: "org-1" });
      expect(hardwareRequestRepository.create).toHaveBeenCalledWith({
        category: "region",
        region: "Frankfurt",
        contactEmail: "jane@example.com",
        userId: "owner-1",
        organizationId: "org-1",
        ...ROUTING
      });
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
        hardwareRequestId: created.id,
        type: "created_on_behalf",
        actor: "Remington",
        payload: { organizationId: "org-1", email: null }
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new HardwareRequestEmailJob({ hardwareRequestId: created.id }));
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new HardwareRequestSlackAlertJob({ hardwareRequestId: created.id }));
    });

    it("files a request for its contact email when no organization is named, for whoever signs up with it", async () => {
      const { service, hardwareRequestRepository, hardwareRequestEventRepository, userRepository, gpuRequestRoutingService, created } = setup();
      userRepository.hasVerifiedEmail.mockResolvedValue(false);

      await service.createOnBehalf({ actor: "Remington", request: anInput() });

      expect(userRepository.hasVerifiedEmail).toHaveBeenCalledWith("jane@example.com");
      expect(gpuRequestRoutingService.route).toHaveBeenCalledWith(expect.anything(), { userId: null, organizationId: null });
      expect(hardwareRequestRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: null, organizationId: null }));
      expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ hardwareRequestId: created.id, payload: { organizationId: null, email: "jane@example.com" } })
      );
    });

    it("answers 409 for a contact email a verified account already uses", async () => {
      const { service, hardwareRequestRepository, userRepository } = setup();
      userRepository.hasVerifiedEmail.mockResolvedValue(true);

      await expect(service.createOnBehalf({ actor: "Remington", request: anInput() })).rejects.toMatchObject({
        status: 409,
        message: "An account already uses this email, so file the request for one of its organizations"
      });
      expect(hardwareRequestRepository.create).not.toHaveBeenCalled();
    });

    it("skips the tenant's rate limits", async () => {
      const { service, hardwareRequestRepository } = setup({ creationTimes: hoursAgo([0.1, 0.2, 0.3]) });

      await service.createOnBehalf({ actor: "Remington", organizationId: "org-1", request: anInput() });

      expect(hardwareRequestRepository.findCreationTimesSince).not.toHaveBeenCalled();
    });

    it.each([
      { case: "does not exist", organization: undefined },
      { case: "was deleted", organization: mock<OrganizationOutput>({ id: "org-1", deletedAt: new Date() }) }
    ])("answers 404 when the organization $case", async ({ organization }) => {
      const { service, hardwareRequestRepository, organizationRepository } = setup();
      organizationRepository.findById.mockResolvedValue(organization);

      await expect(service.createOnBehalf({ actor: "Remington", organizationId: "org-1", request: anInput() })).rejects.toMatchObject({
        status: 404,
        message: "Organization not found"
      });
      expect(hardwareRequestRepository.create).not.toHaveBeenCalled();
    });

    it("answers 422 when the organization has no owner", async () => {
      const { service, hardwareRequestRepository } = setup({ members: [aMember({ userId: "admin-1", role: "admin" })] });

      await expect(service.createOnBehalf({ actor: "Remington", organizationId: "org-1", request: anInput() })).rejects.toMatchObject({
        status: 422,
        message: "The organization has no owner to file the request for"
      });
      expect(hardwareRequestRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns the requests the current user can read, newest first", async () => {
      const { service, hardwareRequestRepository, authService } = setup();
      const requests = [createHardwareRequest(), createHardwareRequest()];
      hardwareRequestRepository.findNewestFirst.mockResolvedValue(requests);

      await expect(service.list()).resolves.toEqual(requests);
      expect(hardwareRequestRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
    });
  });

  function hoursAgo(hours: number[]) {
    return hours.map(value => new Date(NOW - value * HOUR_MS));
  }

  function anInput(): HardwareRequestInput {
    return { category: "region", region: "Frankfurt", email: "jane@example.com" };
  }

  function aMember(member: Pick<OrganizationMemberWithUser, "userId" | "role">) {
    return mock<OrganizationMemberWithUser>(member);
  }

  function setup(
    input: { creationTimes?: Date[]; config?: Partial<HardwareRequestConfig>; organizationId?: string; members?: OrganizationMemberWithUser[] } = {}
  ) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const created = createHardwareRequest({ userId: user.id });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.accessibleBy.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findCreationTimesSince.mockResolvedValue(input.creationTimes ?? []);
    hardwareRequestRepository.create.mockResolvedValue(created);
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();
    const gpuRequestRoutingService = mock<GpuRequestRoutingService>();
    gpuRequestRoutingService.route.mockResolvedValue(ROUTING);
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(key =>
      key === "ORGANIZATION_CONTEXT" && input.organizationId ? mock<OrganizationContext>({ organizationId: input.organizationId }) : undefined
    );
    const hardwareRequestEventRepository = mock<HardwareRequestEventRepository>();
    hardwareRequestEventRepository.record.mockResolvedValue(mock<HardwareRequestEventOutput>());
    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findById.mockResolvedValue(mock<OrganizationOutput>({ id: "org-1", deletedAt: null }));
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.unscoped.mockReturnValue(organizationMemberRepository);
    organizationMemberRepository.findAllWithUsers.mockResolvedValue(input.members ?? [aMember({ userId: "owner-1", role: "owner" })]);
    const config: HardwareRequestConfig = {
      HARDWARE_REQUEST_EMAIL: "support@akash.network",
      HARDWARE_REQUEST_HOURLY_LIMIT: 3,
      HARDWARE_REQUEST_DAILY_LIMIT: 10,
      ...input.config
    };

    const service = new HardwareRequestService(
      hardwareRequestRepository,
      userRepository,
      authService,
      txService,
      jobQueueService,
      gpuRequestRoutingService,
      executionContextService,
      hardwareRequestEventRepository,
      organizationRepository,
      organizationMemberRepository,
      config
    );

    return {
      service,
      hardwareRequestRepository,
      hardwareRequestEventRepository,
      organizationRepository,
      organizationMemberRepository,
      userRepository,
      jobQueueService,
      txService,
      authService,
      gpuRequestRoutingService,
      user,
      created
    };
  }
});
