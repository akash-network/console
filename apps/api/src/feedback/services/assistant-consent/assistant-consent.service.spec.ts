import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { AssistantConsentOutput, AssistantConsentRepository } from "@src/feedback/repositories/assistant-consent/assistant-consent.repository";
import type { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import type { UserRepository } from "@src/user/repositories";
import { AssistantConsentService } from "./assistant-consent.service";

import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const AGREED_AT = new Date("2026-10-01T09:00:00.000Z");
const CHANGED_AT = new Date("2026-10-20T09:00:00.000Z");

describe(AssistantConsentService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPrivacy", () => {
    it("answers no consent and the stored conversation count for a user who never agreed", async () => {
      const { service, user, authService, assistantConsentRepository, assistantConversationRepository } = setup({ storedConversationCount: 0 });

      expect(await service.getPrivacy()).toEqual({ consent: null, storedConversationCount: 0 });
      expect(assistantConsentRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(assistantConsentRepository.findLatestByUserId).toHaveBeenCalledWith(user.id);
      expect(assistantConversationRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(assistantConversationRepository.count).toHaveBeenCalledWith({ userId: user.id });
    });

    it("answers the latest consent with the date the copy version was agreed to", async () => {
      const { service } = setup({ latest: { copyVersion: "v2", reviewOptIn: true }, storedConversationCount: 3 });

      expect(await service.getPrivacy()).toEqual({
        consent: { copyVersion: "v2", processingAcceptedAt: AGREED_AT.toISOString(), reviewOptIn: true, updatedAt: CHANGED_AT.toISOString() },
        storedConversationCount: 3
      });
    });
  });

  describe("updateConsent", () => {
    it("records a first agreement as accepted now", async () => {
      const { service, user, authService, assistantConsentRepository } = setup();

      const privacy = await service.updateConsent({ copyVersion: "v1", reviewOptIn: false });

      expect(assistantConsentRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
      expect(assistantConsentRepository.create).toHaveBeenCalledWith({ userId: user.id, copyVersion: "v1", reviewOptIn: false, processingAcceptedAt: NOW });
      expect(privacy.consent).toMatchObject({ copyVersion: "v1", processingAcceptedAt: NOW.toISOString(), reviewOptIn: false });
    });

    it("keeps the agreement date when only the review opt-in changes", async () => {
      const { service, user, assistantConsentRepository } = setup({ latest: { copyVersion: "v1", reviewOptIn: false } });

      await service.updateConsent({ copyVersion: "v1", reviewOptIn: true });

      expect(assistantConsentRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        copyVersion: "v1",
        reviewOptIn: true,
        processingAcceptedAt: AGREED_AT
      });
    });

    it("records a new agreement date when the user agrees to a new copy version", async () => {
      const { service, user, assistantConsentRepository } = setup({ latest: { copyVersion: "v1", reviewOptIn: true } });

      await service.updateConsent({ copyVersion: "v2", reviewOptIn: true });

      expect(assistantConsentRepository.create).toHaveBeenCalledWith({ userId: user.id, copyVersion: "v2", reviewOptIn: true, processingAcceptedAt: NOW });
    });

    it("records nothing when the consent did not change", async () => {
      const { service, assistantConsentRepository } = setup({ latest: { copyVersion: "v1", reviewOptIn: true } });

      const privacy = await service.updateConsent({ copyVersion: "v1", reviewOptIn: true });

      expect(assistantConsentRepository.create).not.toHaveBeenCalled();
      expect(privacy.consent).toEqual({
        copyVersion: "v1",
        processingAcceptedAt: AGREED_AT.toISOString(),
        reviewOptIn: true,
        updatedAt: CHANGED_AT.toISOString()
      });
    });

    it("reads the latest consent after locking the user row, inside the transaction", async () => {
      const { service, user, txService, userRepository, assistantConsentRepository } = setup();
      txService.transaction.mockImplementation(async cb => {
        expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
        return await cb();
      });

      await service.updateConsent({ copyVersion: "v1", reviewOptIn: false });

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id }, { strength: "no key update" });
      expect(userRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        assistantConsentRepository.findLatestByUserId.mock.invocationCallOrder[0]
      );
    });
  });

  function setup(input: { latest?: Pick<AssistantConsentOutput, "copyVersion" | "reviewOptIn">; storedConversationCount?: number } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const latest: AssistantConsentOutput | undefined = input.latest && {
      id: faker.string.uuid(),
      userId: user.id,
      processingAcceptedAt: AGREED_AT,
      createdAt: CHANGED_AT,
      ...input.latest
    };
    const assistantConsentRepository = mock<AssistantConsentRepository>();
    assistantConsentRepository.accessibleBy.mockReturnValue(assistantConsentRepository);
    assistantConsentRepository.findLatestByUserId.mockResolvedValue(latest);
    assistantConsentRepository.create.mockImplementation(async consent => ({
      id: faker.string.uuid(),
      userId: user.id,
      copyVersion: "",
      reviewOptIn: false,
      processingAcceptedAt: NOW,
      createdAt: NOW,
      ...consent
    }));
    const assistantConversationRepository = mock<AssistantConversationRepository>();
    assistantConversationRepository.accessibleBy.mockReturnValue(assistantConversationRepository);
    assistantConversationRepository.count.mockResolvedValue(input.storedConversationCount ?? 0);
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const service = new AssistantConsentService(assistantConsentRepository, assistantConversationRepository, userRepository, authService, txService);

    return { service, user, authService, txService, userRepository, assistantConsentRepository, assistantConversationRepository };
  }
});
