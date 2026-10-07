import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import { UserRepository } from "@src/user/repositories";
import { CONFIGURE_DRAFT_TTL_DAYS, ExpireConfigureDraft, ExpireConfigureDraftHandler, expireConfigureDraftKeyFor } from "./expire-configure-draft.handler";

import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ExpireConfigureDraftHandler)]);

describe(ExpireConfigureDraftHandler.name, () => {
  it("deletes a draft last saved longer ago than drafts are kept, run the way a worker runs it", async () => {
    const { seedDraft, expire, findDraft } = await setup();
    const draft = await seedDraft(subDays(new Date(), CONFIGURE_DRAFT_TTL_DAYS + 1));

    await expire(draft.id);

    expect(await findDraft(draft.id)).toBeUndefined();
  });

  it("keeps a draft saved since it was scheduled and checks it again at its new expiry", async () => {
    const { seedDraft, expire, findDraft } = await setup();
    const savedAt = subHours(new Date(), 1);
    const draft = await seedDraft(savedAt);

    await expire(draft.id);
    const [rescheduled] = await findJobRows(ExpireConfigureDraft[JOB_NAME], { singletonKey: expireConfigureDraftKeyFor(draft.id), state: "created" });

    expect(await findDraft(draft.id)).toBeDefined();
    expect(new Date(rescheduled.start_after).getTime()).toBe(savedAt.getTime() + CONFIGURE_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("completes for a draft already gone", async () => {
    const { expire } = await setup();

    await expire(faker.string.uuid());
  });

  async function setup() {
    const user = await container.resolve(UserRepository).create({ userId: faker.string.uuid() });
    const configureDraftRepository = container.resolve(ConfigureDraftRepository);
    const { enqueue, startWorkers } = await jobWorkers();

    async function seedDraft(updatedAt: Date) {
      return await configureDraftRepository.create({ userId: user.id, draftId: faker.string.alphanumeric(21), content: { sdl: "version: '2.0'" }, updatedAt });
    }

    async function expire(configureDraftId: string) {
      const singletonKey = expireConfigureDraftKeyFor(configureDraftId);
      await enqueue(new ExpireConfigureDraft({ configureDraftId }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(ExpireConfigureDraft[JOB_NAME], { singletonKey, state: "completed" });
    }

    async function findDraft(id: string) {
      return await configureDraftRepository.findById(id);
    }

    return { seedDraft, expire, findDraft };
  }
});
