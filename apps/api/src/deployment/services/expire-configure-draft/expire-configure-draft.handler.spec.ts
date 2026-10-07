import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { ConfigureDraftOutput, ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import { CONFIGURE_DRAFT_TTL_DAYS, ExpireConfigureDraft, ExpireConfigureDraftHandler } from "./expire-configure-draft.handler";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe(ExpireConfigureDraftHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs no permission, since it runs outside any user's request", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("deletes a draft unless it was saved within the time drafts are kept", async () => {
    const { handler, configureDraftRepository, jobQueueService, draft } = setup({ isExpired: true });

    await handler.handle({ configureDraftId: draft.id, version: 1 });

    expect(configureDraftRepository.deleteIfNotSavedSince).toHaveBeenCalledWith(draft.id, subDays(NOW, CONFIGURE_DRAFT_TTL_DAYS));
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("checks a draft saved since it was scheduled again at its new expiry", async () => {
    const { handler, jobQueueService, draft } = setup({ updatedAt: subDays(NOW, 1) });

    await handler.handle({ configureDraftId: draft.id, version: 1 });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ExpireConfigureDraft({ configureDraftId: draft.id }), {
      singletonKey: `expireConfigureDraft.${draft.id}`,
      startAfter: "2026-11-04T12:00:00.000Z"
    });
  });

  it("does nothing for a draft already gone", async () => {
    const { handler, jobQueueService } = setup({ isGone: true });

    await handler.handle({ configureDraftId: faker.string.uuid(), version: 1 });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  function setup(input: { updatedAt?: Date; isGone?: boolean; isExpired?: boolean } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const draft: ConfigureDraftOutput = {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      draftId: faker.string.alphanumeric(21),
      content: { sdl: "version: '2.0'" },
      createdAt: input.updatedAt ?? NOW,
      updatedAt: input.updatedAt ?? NOW
    };
    const configureDraftRepository = mock<ConfigureDraftRepository>();
    configureDraftRepository.deleteIfNotSavedSince.mockResolvedValue(!!input.isExpired);
    configureDraftRepository.findById.mockResolvedValue(input.isGone ? undefined : draft);
    const jobQueueService = mock<JobQueueService>();

    const handler = new ExpireConfigureDraftHandler(configureDraftRepository, jobQueueService, () => mock<ReturnType<CreateLogger>>());

    return { handler, configureDraftRepository, jobQueueService, draft };
  }
});
