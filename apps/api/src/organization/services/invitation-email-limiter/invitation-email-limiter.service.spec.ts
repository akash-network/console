import { faker } from "@faker-js/faker";
import { addSeconds, subHours } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type {
  InvitationEmailSend,
  OrganizationInvitationEmailRepository
} from "@src/organization/repositories/organization-invitation-email/organization-invitation-email.repository";
import type { UserRepository } from "@src/user/repositories";
import { INVITATION_EMAIL_LIMIT_ERROR_CODE, INVITATION_EMAIL_LIMITS, InvitationEmailLimiter } from "./invitation-email-limiter.service";

import { createOrganizationInvitation } from "@test/seeders/organization.seeder";

const NOW = new Date("2026-10-09T12:00:00Z");
const WINDOW_START = subHours(NOW, 24);

describe(InvitationEmailLimiter.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("assertWithinLimits", () => {
    it("locks the organization, then the sender, then counts the sends of the last day", async () => {
      const { limiter, organizationId, senderId, emailRepository, userRepository, organizationRepository } = setup({});

      await limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com"] });

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: senderId }, { strength: "no key update" });
      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: organizationId }, { strength: "no key update" });
      expect(organizationRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(userRepository.findOneByAndLock.mock.invocationCallOrder[0]);
      expect(emailRepository.findSendsSince).toHaveBeenCalledWith({ organizationId }, WINDOW_START);
      expect(emailRepository.findSendsSince).toHaveBeenCalledWith({ sentByUserId: senderId }, WINDOW_START);
    });

    it("neither locks nor counts anything without an address", async () => {
      const { limiter, organizationId, senderId, emailRepository, userRepository } = setup({});

      await limiter.assertWithinLimits({ organizationId, senderId, emails: [] });

      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(emailRepository.findSendsSince).not.toHaveBeenCalled();
    });

    it("lets the organization use its whole allowance", async () => {
      const { limiter, organizationId, senderId } = setup({ organizationSends: sends(INVITATION_EMAIL_LIMITS.perOrganization - 2) });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com", "joe@example.com"] })).resolves.toBeUndefined();
    });

    it("refuses sends beyond the organization's allowance until the oldest sends over it leave the window", async () => {
      const organizationSends = sends(INVITATION_EMAIL_LIMITS.perOrganization - 1);
      const { limiter, organizationId, senderId } = setup({ organizationSends });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com", "joe@example.com"] })).rejects.toMatchObject({
        status: 429,
        errorCode: INVITATION_EMAIL_LIMIT_ERROR_CODE,
        headers: { "Retry-After": "1" }
      });
    });

    it("refuses sends beyond the sender's allowance", async () => {
      const { limiter, organizationId, senderId } = setup({ senderSends: sends(INVITATION_EMAIL_LIMITS.perSender, { firstOffsetSeconds: 600 }) });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com"] })).rejects.toMatchObject({
        status: 429,
        headers: { "Retry-After": "600" }
      });
    });

    it("refuses another email to an address the organization already emailed as often as allowed", async () => {
      const organizationSends = sends(INVITATION_EMAIL_LIMITS.perAddress, { email: "jane@example.com", firstOffsetSeconds: 30 });
      const { limiter, organizationId, senderId } = setup({ organizationSends });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["joe@example.com", "jane@example.com"] })).rejects.toMatchObject({
        status: 429,
        headers: { "Retry-After": "30" }
      });
    });

    it("lets the organization email another address that it emailed less often", async () => {
      const organizationSends = sends(INVITATION_EMAIL_LIMITS.perAddress - 1, { email: "jane@example.com" });
      const { limiter, organizationId, senderId } = setup({ organizationSends });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com"] })).resolves.toBeUndefined();
    });

    it("asks to wait for the latest of the limits to lift", async () => {
      const { limiter, organizationId, senderId } = setup({
        organizationSends: sends(INVITATION_EMAIL_LIMITS.perOrganization, { firstOffsetSeconds: 60 }),
        senderSends: sends(INVITATION_EMAIL_LIMITS.perSender, { firstOffsetSeconds: 120 })
      });

      await expect(limiter.assertWithinLimits({ organizationId, senderId, emails: ["jane@example.com"] })).rejects.toMatchObject({
        headers: { "Retry-After": "120" }
      });
    });
  });

  describe("recordSends", () => {
    it("records one send per invitation by the sender", async () => {
      const { limiter, senderId, emailRepository } = setup({});
      const invitations = [createOrganizationInvitation(), createOrganizationInvitation()];

      await limiter.recordSends(invitations, senderId);

      expect(emailRepository.recordSends).toHaveBeenCalledWith(
        invitations.map(invitation => ({ organizationId: invitation.organizationId, invitationId: invitation.id, sentByUserId: senderId }))
      );
    });
  });

  function sends(count: number, options: { email?: string; firstOffsetSeconds?: number } = {}): InvitationEmailSend[] {
    return Array.from({ length: count }, (_, index) => ({
      email: options.email ?? faker.internet.email().toLowerCase(),
      createdAt: addSeconds(WINDOW_START, (options.firstOffsetSeconds ?? 1) + index)
    }));
  }

  function setup(input: { organizationSends?: InvitationEmailSend[]; senderSends?: InvitationEmailSend[] }) {
    vi.useFakeTimers({ now: NOW });
    const organizationId = faker.string.uuid();
    const senderId = faker.string.uuid();
    const emailRepository = mock<OrganizationInvitationEmailRepository>();
    emailRepository.findSendsSince.mockImplementation(async filter => ("organizationId" in filter ? input.organizationSends ?? [] : input.senderSends ?? []));
    const organizationRepository = mock<OrganizationRepository>();
    const userRepository = mock<UserRepository>();
    const limiter = new InvitationEmailLimiter(emailRepository, organizationRepository, userRepository);

    return { limiter, organizationId, senderId, emailRepository, organizationRepository, userRepository };
  }
});
