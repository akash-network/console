import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { AdminAccessRequestEmailJob } from "@src/organization/services/admin-access-request-email/admin-access-request-email.handler";
import { PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/organization-member/organization-member.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import {
  ADMIN_ACCESS_REQUEST_LIMIT_ERROR_CODE,
  ADMIN_ACCESS_REQUEST_WINDOW_SECONDS,
  AdminAccessRequestService,
  ALREADY_ADMIN_ERROR_CODE
} from "./admin-access-request.service";

import { createOrganizationMember } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(AdminAccessRequestService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request", () => {
    it.each<OrganizationRole>(["member", "billing", "viewer"])("queues an email to every owner for a caller with role %s", async role => {
      const { service, context, caller, owners, jobQueueService, txService } = setup({ role, ownerCount: 2 });

      await service.request(context.organizationId);

      expect(txService.transaction).toHaveBeenCalledOnce();
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
      for (const owner of owners) {
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(
          new AdminAccessRequestEmailJob({
            organizationId: context.organizationId,
            requesterUserId: caller.id,
            ownerUserId: owner.userId,
            requestedAt: expect.any(String)
          }),
          { singletonKey: `${context.organizationId}.${caller.id}.${owner.userId}`, singletonSeconds: ADMIN_ACCESS_REQUEST_WINDOW_SECONDS }
        );
      }
    });

    it("reads only the owners of the requested organization", async () => {
      const { service, context, organizationMemberRepository } = setup({});

      await service.request(context.organizationId);

      expect(organizationMemberRepository.find).toHaveBeenCalledWith({ organizationId: context.organizationId, role: "owner" });
    });

    it("stamps every owner's email with the same request time", async () => {
      const { service, context, jobQueueService } = setup({ ownerCount: 2 });

      await service.request(context.organizationId);

      const [first, second] = jobQueueService.enqueue.mock.calls.map(([job]) => (job as AdminAccessRequestEmailJob).data.requestedAt);
      expect(new Date(first).toISOString()).toBe(first);
      expect(second).toBe(first);
    });

    it("succeeds when at least one owner has not been emailed in the current window", async () => {
      const { service, context } = setup({ ownerCount: 2, jobIds: [null, "job-2"] });

      await expect(service.request(context.organizationId)).resolves.toBeUndefined();
    });

    it("refuses once every owner was already emailed in the current window, saying when the next one opens", async () => {
      const { service, context } = setup({ ownerCount: 2, jobIds: [null, null], now: new Date("2026-10-26T18:00:00.000Z") });

      await expect(service.request(context.organizationId)).rejects.toMatchObject({
        status: 429,
        message: "You already asked for admin access today. Try again tomorrow.",
        errorCode: ADMIN_ACCESS_REQUEST_LIMIT_ERROR_CODE,
        headers: { "Retry-After": String(6 * 60 * 60) }
      });
    });

    it("waits a whole window when refused right as one opens", async () => {
      const { service, context } = setup({ jobIds: [null], now: new Date("2026-10-27T00:00:00.000Z") });

      await expect(service.request(context.organizationId)).rejects.toMatchObject({
        headers: { "Retry-After": String(ADMIN_ACCESS_REQUEST_WINDOW_SECONDS) }
      });
    });

    it.each<OrganizationRole>(["owner", "admin"])("refuses a caller with role %s, who already manages the organization", async role => {
      const { service, context, jobQueueService } = setup({ role });

      await expect(service.request(context.organizationId)).rejects.toMatchObject({
        status: 409,
        message: "You already manage this organization",
        errorCode: ALREADY_ADMIN_ERROR_CODE
      });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("refuses a personal organization", async () => {
      const { service, context, jobQueueService } = setup({ context: createOrganizationContext({ organizationType: "personal", role: "member" }) });

      await expect(service.request(context.organizationId)).rejects.toMatchObject({
        status: 403,
        message: "A personal organization has no one to ask for admin access",
        errorCode: PERSONAL_ORGANIZATION_ERROR_CODE
      });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("answers not found for an organization other than the active one", async () => {
      const { service, jobQueueService } = setup({});

      await expect(service.request(createOrganizationContext().organizationId)).rejects.toMatchObject({ status: 404, message: "Organization not found" });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("refuses a request without an active organization", async () => {
      const { service, jobQueueService } = setup({ context: null });

      await expect(service.request(createOrganizationContext().organizationId)).rejects.toMatchObject({ status: 403, message: "No active organization" });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  function setup(input: { role?: OrganizationRole; context?: OrganizationContext | null; ownerCount?: number; jobIds?: (string | null)[]; now?: Date }) {
    if (input.now) vi.useFakeTimers({ now: input.now, toFake: ["Date"] });
    const context = input.context === undefined ? createOrganizationContext({ role: input.role ?? "member" }) : input.context;
    const caller = createUser();
    const owners = Array.from({ length: input.ownerCount ?? 1 }, () => createOrganizationMember({ role: "owner", organizationId: context?.organizationId }));
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ find: vi.fn().mockResolvedValue(owners) });
    const jobIds = input.jobIds ?? owners.map((_, index) => `job-${index}`);
    const jobQueueService = mock<JobQueueService>();
    jobIds.forEach(jobId => jobQueueService.enqueue.mockResolvedValueOnce(jobId));
    const authService = mock<AuthService>({ currentUser: caller });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const service = new AdminAccessRequestService(organizationMemberRepository, jobQueueService, authService, executionContextService, txService);

    return { service, context: context ?? createOrganizationContext(), caller, owners, organizationMemberRepository, jobQueueService, txService };
  }
});
