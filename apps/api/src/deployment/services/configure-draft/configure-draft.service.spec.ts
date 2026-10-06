import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { ConfigureDraftOutput, ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import { CONFIGURE_DRAFT_TTL_DAYS, ExpireConfigureDraft } from "@src/deployment/services/expire-configure-draft/expire-configure-draft.handler";
import { ConfigureDraftService, MAX_CONFIGURE_DRAFTS_PER_USER } from "./configure-draft.service";

import { createUser } from "@test/seeders/user.seeder";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe(ConfigureDraftService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("get", () => {
    it("answers the draft the user may read", async () => {
      const { service, configureDraftRepository, authService, draft } = setup();

      expect(await service.get(draft.draftId)).toBe(draft);
      expect(configureDraftRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(configureDraftRepository.findByDraftId).toHaveBeenCalledWith(draft.draftId);
    });

    it("answers 404 for a draft the user does not have", async () => {
      const { service } = setup({ stored: null });

      await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });
    });

    it("answers 404 for a draft last saved as long ago as it is kept", async () => {
      const { service, draft } = setup({ updatedAt: subDays(NOW, CONFIGURE_DRAFT_TTL_DAYS) });

      await expect(service.get(draft.draftId)).rejects.toMatchObject({ status: 404 });
    });

    it("answers a draft saved just inside the time it is kept", async () => {
      const { service, draft } = setup({ updatedAt: new Date(subDays(NOW, CONFIGURE_DRAFT_TTL_DAYS).getTime() + 1) });

      expect(await service.get(draft.draftId)).toBe(draft);
    });
  });

  describe("save", () => {
    it("stores a new draft for the current user, keeps the newest drafts and schedules its expiry, all in one transaction", async () => {
      const { service, configureDraftRepository, jobQueueService, txService, authService, user, draft } = setup({ isNew: true });
      const content = { sdl: "version: '2.0'" };

      expect(await service.save(draft.draftId, content)).toBe(draft);
      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(configureDraftRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "create");
      expect(configureDraftRepository.createOrReplace).toHaveBeenCalledWith({ userId: user.id, draftId: draft.draftId, content });
      expect(configureDraftRepository.deleteAllButNewest).toHaveBeenCalledWith(user.id, MAX_CONFIGURE_DRAFTS_PER_USER);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ExpireConfigureDraft({ configureDraftId: draft.id }), {
        singletonKey: `expireConfigureDraft.${draft.id}`,
        startAfter: "2026-11-05T12:00:00.000Z"
      });
    });

    it("replaces a draft without dropping others or scheduling another expiry", async () => {
      const { service, configureDraftRepository, jobQueueService, draft } = setup({ isNew: false });

      expect(await service.save(draft.draftId, { sdl: "version: '2.0'" })).toBe(draft);
      expect(configureDraftRepository.deleteAllButNewest).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes the draft among those the user may delete", async () => {
      const { service, configureDraftRepository, authService } = setup();

      await service.delete("draft-1");

      expect(configureDraftRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "delete");
      expect(configureDraftRepository.deleteBy).toHaveBeenCalledWith({ draftId: "draft-1" });
    });
  });

  function setup(input: { stored?: null; updatedAt?: Date; isNew?: boolean } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const user = createUser();
    const draft: ConfigureDraftOutput = {
      id: faker.string.uuid(),
      userId: user.id,
      draftId: faker.string.alphanumeric(21),
      content: { sdl: "version: '2.0'" },
      createdAt: input.updatedAt ?? NOW,
      updatedAt: input.updatedAt ?? NOW
    };
    const configureDraftRepository = mock<ConfigureDraftRepository>();
    configureDraftRepository.accessibleBy.mockReturnValue(configureDraftRepository);
    configureDraftRepository.findByDraftId.mockResolvedValue(input.stored === null ? undefined : draft);
    configureDraftRepository.createOrReplace.mockResolvedValue({ draft, isNew: input.isNew ?? true });
    const authService = mock<AuthService>({ currentUser: user });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const jobQueueService = mock<JobQueueService>();

    const service = new ConfigureDraftService(configureDraftRepository, authService, txService, jobQueueService);

    return { service, configureDraftRepository, authService, txService, jobQueueService, user, draft };
  }
});
