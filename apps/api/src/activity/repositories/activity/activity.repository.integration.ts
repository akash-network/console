import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import type { ActivityInitiator, ActivityStatus } from "@src/activity/model-schemas";
import { AbilityService } from "@src/auth/services/ability/ability.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { ActivityRepository, isDedupeKeyTaken } from "./activity.repository";

describe(ActivityRepository.name, () => {
  describe("findPage", () => {
    it("lists the owner's activities newest first and leaves out everyone else's", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const stranger = await createUser();
      const older = await seed(owner.id, { createdAt: new Date("2026-10-05T10:00:00.000Z") });
      const newer = await seed(owner.id, { createdAt: new Date("2026-10-05T11:00:00.000Z") });
      await seed(stranger.id);

      const page = await repository.accessibleBy(owner.ability, "read").findPage({ limit: 10 });

      expect(page.map(activity => activity.id)).toEqual([newer.id, older.id]);
    });

    it("pages through activities sharing a millisecond without skipping or repeating any", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const createdAt = new Date("2026-10-05T10:00:00.123Z");
      const seeded = await Promise.all(Array.from({ length: 5 }, () => seed(owner.id, { createdAt })));
      const scoped = repository.accessibleBy(owner.ability, "read");

      const first = await scoped.findPage({ limit: 2 });
      const second = await scoped.findPage({ limit: 2, after: first[1] });
      const third = await scoped.findPage({ limit: 2, after: second[1] });

      const pagedIds = [...first, ...second, ...third].map(activity => activity.id);
      expect(pagedIds).toEqual(
        seeded
          .map(activity => activity.id)
          .sort()
          .reverse()
      );
    });

    it("keeps only the activities in the requested status", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const failed = await seed(owner.id, { status: "failed" });
      await seed(owner.id, { status: "succeeded" });

      const page = await repository.accessibleBy(owner.ability, "read").findPage({ limit: 10, status: "failed", type: "deployment_close" });

      expect(page.map(activity => activity.id)).toEqual([failed.id]);
    });
  });

  describe("countUnseen", () => {
    it("counts only the owner's activities nobody has marked seen", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const stranger = await createUser();
      await seed(owner.id);
      await seed(owner.id);
      await seed(owner.id, { seenAt: new Date() });
      await seed(stranger.id);

      expect(await repository.accessibleBy(owner.ability, "read").countUnseen()).toBe(2);
    });
  });

  describe("markSeen", () => {
    it("marks the selected activities of the owner and ignores ids belonging to someone else", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const stranger = await createUser();
      const selected = await seed(owner.id);
      const unselected = await seed(owner.id);
      const strangers = await seed(stranger.id);

      await repository.accessibleBy(owner.ability, "update").markSeen({ ids: [selected.id, strangers.id] });

      expect((await repository.findById(selected.id))?.seenAt).not.toBeNull();
      expect((await repository.findById(unselected.id))?.seenAt).toBeNull();
      expect((await repository.findById(strangers.id))?.seenAt).toBeNull();
    });

    it("marks every activity created up to the given time", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const before = await seed(owner.id, { createdAt: new Date("2026-10-05T10:00:00.000Z") });
      const at = await seed(owner.id, { createdAt: new Date("2026-10-05T11:00:00.000Z") });
      const after = await seed(owner.id, { createdAt: new Date("2026-10-05T12:00:00.000Z") });

      await repository.accessibleBy(owner.ability, "update").markSeen({ upTo: "2026-10-05T11:00:00.000Z" });

      expect((await repository.findById(before.id))?.seenAt).not.toBeNull();
      expect((await repository.findById(at.id))?.seenAt).not.toBeNull();
      expect((await repository.findById(after.id))?.seenAt).toBeNull();
    });

    it("keeps the time an activity was first seen", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const firstSeenAt = new Date("2026-10-01T09:00:00.000Z");
      const seen = await seed(owner.id, { seenAt: firstSeenAt });

      await repository.accessibleBy(owner.ability, "update").markSeen({ ids: [seen.id] });

      expect((await repository.findById(seen.id))?.seenAt).toBe(firstSeenAt.toISOString());
    });
  });

  describe("createUnlessDuplicate", () => {
    it("writes a row whose dedupe key none of the user's rows holds", async () => {
      const { repository, createUser } = setup();
      const owner = await createUser();
      const dedupeKey = deploymentCloseDedupeKeyOf("1001");

      const created = await repository.createUnlessDuplicate({
        userId: owner.id,
        type: "deployment_close",
        status: "succeeded",
        initiator: "system",
        meta: { dseq: "1001", reason: "trial_ended" },
        dedupeKey
      });

      expect(await repository.find({ userId: owner.id })).toEqual([created]);
      expect(created).toMatchObject({ initiator: "system", meta: { dseq: "1001", reason: "trial_ended" }, dedupeKey });
    });

    it("writes nothing when another of the user's rows already holds the dedupe key, and leaves that row as it was", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const dedupeKey = deploymentCloseDedupeKeyOf("1001");
      const usersClose = await seed(owner.id, { status: "pending", meta: { dseq: "1001" }, dedupeKey });

      const created = await repository.createUnlessDuplicate({
        userId: owner.id,
        type: "deployment_close",
        status: "succeeded",
        initiator: "system",
        meta: { dseq: "1001", reason: "runtime_limit_reached" },
        dedupeKey
      });

      expect(created).toBeUndefined();
      expect(await repository.find({ userId: owner.id })).toEqual([usersClose]);
      expect(await repository.findOneBy({ userId: owner.id, dedupeKey })).toEqual(usersClose);
    });

    it("lets each user hold the same dedupe key, since a dseq only names a deployment within one owner", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const stranger = await createUser();
      const dedupeKey = deploymentCloseDedupeKeyOf("1001");
      await seed(stranger.id, { meta: { dseq: "1001" }, dedupeKey });

      const created = await repository.createUnlessDuplicate({
        userId: owner.id,
        type: "deployment_close",
        status: "succeeded",
        initiator: "user",
        meta: { dseq: "1001" },
        dedupeKey
      });

      expect(created).toMatchObject({ userId: owner.id, dedupeKey });
    });

    it("never holds back a row without a dedupe key, so every failed attempt keeps its own row", async () => {
      const { repository, createUser } = setup();
      const owner = await createUser();
      const failedAttempt = { userId: owner.id, type: "deployment_close" as const, status: "failed" as const, initiator: "user" as const, dedupeKey: null };

      await repository.createUnlessDuplicate({ ...failedAttempt, meta: { dseq: "1001", error: { code: "close_failed", message: "First" } } });
      await repository.createUnlessDuplicate({ ...failedAttempt, meta: { dseq: "1001", error: { code: "close_failed", message: "Second" } } });

      expect(await repository.count({ userId: owner.id })).toBe(2);
    });
  });

  describe("updateByIdIfStatusIn", () => {
    it("frees the dedupe key of a close settled as failed, so the next close of the deployment can hold it", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const dedupeKey = deploymentCloseDedupeKeyOf("1001");
      const gaveUp = await seed(owner.id, { status: "pending", meta: { dseq: "1001" }, dedupeKey });

      await repository.updateByIdIfStatusIn(gaveUp.id, ["pending"], { status: "failed", meta: { dseq: "1001" }, dedupeKey: null });
      const retried = await repository.createUnlessDuplicate({
        userId: owner.id,
        type: "deployment_close",
        status: "pending",
        initiator: "user",
        meta: { dseq: "1001" },
        dedupeKey
      });

      expect(retried).toMatchObject({ dedupeKey });
      expect(await repository.findById(gaveUp.id)).toMatchObject({ status: "failed", dedupeKey: null });
    });

    it("refuses to settle a row onto a dedupe key another row holds, leaving the row as it was", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const dedupeKey = deploymentCloseDedupeKeyOf("1001");
      const gaveUp = await seed(owner.id, { status: "failed", meta: { dseq: "1001" } });
      await seed(owner.id, { status: "pending", meta: { dseq: "1001" }, dedupeKey });

      await expect(
        repository.updateByIdIfStatusIn(gaveUp.id, ["pending", "failed"], { status: "succeeded", meta: { dseq: "1001" }, dedupeKey })
      ).rejects.toSatisfy(isDedupeKeyTaken);

      expect(await repository.findById(gaveUp.id)).toMatchObject({ status: "failed", dedupeKey: null });
    });

    it("updates the activity only while it is in one of the given statuses", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const failed = await seed(owner.id, { status: "failed" });
      const succeeded = await seed(owner.id, { status: "succeeded" });
      const outcome = { status: "succeeded" as const, meta: { dseq: "100" } };

      await repository.updateByIdIfStatusIn(failed.id, ["pending", "failed"], outcome);
      await repository.updateByIdIfStatusIn(succeeded.id, ["pending", "failed"], { status: "failed", meta: { dseq: "200" } });

      expect(await repository.findById(failed.id)).toMatchObject(outcome);
      expect(await repository.findById(succeeded.id)).toMatchObject({ status: "succeeded", meta: succeeded.meta });
    });

    it("updates no activity but the one with the given id", async () => {
      const { repository, createUser, seed } = setup();
      const owner = await createUser();
      const target = await seed(owner.id, { status: "pending" });
      const bystander = await seed(owner.id, { status: "pending" });

      await repository.updateByIdIfStatusIn(target.id, ["pending"], { status: "succeeded" });

      expect(await repository.findById(target.id)).toMatchObject({ status: "succeeded" });
      expect(await repository.findById(bystander.id)).toMatchObject({ status: "pending" });
    });
  });

  function setup() {
    const repository = container.resolve(ActivityRepository);
    const userRepository = container.resolve(UserRepository);
    const abilityService = container.resolve(AbilityService);

    async function createUser() {
      const user = await userRepository.create({ userId: faker.string.uuid() });
      return { id: user.id, ability: abilityService.getAbilityFor("REGULAR_USER", user) };
    }

    async function seed(
      userId: string,
      overrides: {
        status?: ActivityStatus;
        initiator?: ActivityInitiator;
        createdAt?: Date;
        seenAt?: Date;
        meta?: { dseq: string };
        dedupeKey?: string;
      } = {}
    ) {
      return await repository.create({ userId, type: "deployment_close", status: "succeeded", meta: { dseq: faker.string.numeric(6) }, ...overrides });
    }

    return { repository, createUser, seed };
  }
});
