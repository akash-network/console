import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { OrganizationInvitationEmailRepository } from "@src/organization/repositories/organization-invitation-email/organization-invitation-email.repository";
import { PurgeOrganizationInvitationEmailsHandler } from "./purge-organization-invitation-emails.handler";
import { PurgeOrganizationInvitationEmailsJob } from "./purge-organization-invitation-emails.job";

const NOW = new Date("2026-10-10T12:00:00.000Z");

describe(PurgeOrganizationInvitationEmailsHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs no permission, since it runs outside any user's request", () => {
    const { handler } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("keeps one waiting purge per organization", () => {
    const { handler } = setup({});

    expect(handler.policy).toBe("short");
  });

  it("deletes the organization's sends recorded before retention started, outside organization scoping", async () => {
    const { handler, organizationId, emailRepository, retainedEmails } = setup({});

    await handler.handle({ organizationId, version: 1 });

    expect(emailRepository.unscoped).toHaveBeenCalledWith("invitation-email-retention");
    expect(retainedEmails.deleteSentBefore).toHaveBeenCalledWith(organizationId, new Date("2026-10-09T11:00:00.000Z"));
  });

  it("logs how many sends it purged", async () => {
    const { handler, organizationId, logger } = setup({ purgedCount: 3 });

    await handler.handle({ organizationId, version: 1 });

    expect(logger.info).toHaveBeenCalledWith({ event: "ORGANIZATION_INVITATION_EMAILS_PURGED", organizationId, purgedCount: 3 });
  });

  it("queues the next purge for when the oldest send it kept leaves retention", async () => {
    const { handler, organizationId, retainedEmails, jobQueueService } = setup({ oldestKeptSentAt: new Date("2026-10-10T08:30:00.000Z") });

    await handler.handle({ organizationId, version: 1 });

    expect(retainedEmails.findOldestSentAt).toHaveBeenCalledWith(organizationId);
    expect(retainedEmails.deleteSentBefore.mock.invocationCallOrder[0]).toBeLessThan(retainedEmails.findOldestSentAt.mock.invocationCallOrder[0]);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PurgeOrganizationInvitationEmailsJob({ organizationId }), {
      singletonKey: `purgeOrganizationInvitationEmails.${organizationId}`,
      startAfter: "2026-10-11T09:30:00.000Z"
    });
  });

  it("queues no other purge once the organization has no send left", async () => {
    const { handler, organizationId, jobQueueService } = setup({});

    await handler.handle({ organizationId, version: 1 });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  function setup(input: { purgedCount?: number; oldestKeptSentAt?: Date }) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const organizationId = faker.string.uuid();
    const retainedEmails = mock<OrganizationInvitationEmailRepository>();
    retainedEmails.deleteSentBefore.mockResolvedValue(input.purgedCount ?? 0);
    retainedEmails.findOldestSentAt.mockResolvedValue(input.oldestKeptSentAt);
    const emailRepository = mock<OrganizationInvitationEmailRepository>();
    emailRepository.unscoped.mockReturnValue(retainedEmails);
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const handler = new PurgeOrganizationInvitationEmailsHandler(emailRepository, jobQueueService, () => logger);

    return { handler, organizationId, emailRepository, retainedEmails, jobQueueService, logger };
  }
});
