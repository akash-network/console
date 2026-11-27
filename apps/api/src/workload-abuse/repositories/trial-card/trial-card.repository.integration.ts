import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TrialCardRepository } from "./trial-card.repository";

describe(TrialCardRepository.name, () => {
  describe("claim", () => {
    it("gives an unspent card to the user who claims it", async () => {
      const { repository, cardHash, userId } = setup();

      const claim = await repository.claim({ cardHash, userId });

      expect(claim).toMatchObject({ cardHash, userId, createdAt: expect.any(Date) });
    });

    it("returns the first user's row to a second user claiming the same card", async () => {
      const { repository, cardHash, userId } = setup();
      const secondUserId = faker.string.uuid();
      const first = await repository.claim({ cardHash, userId });

      const second = await repository.claim({ cardHash, userId: secondUserId });

      expect(second).toEqual(first);
      await expect(repository.existsForUser(secondUserId)).resolves.toBe(false);
    });

    it("returns the same row to a user claiming their card again", async () => {
      const { repository, cardHash, userId } = setup();
      const first = await repository.claim({ cardHash, userId });

      await expect(repository.claim({ cardHash, userId })).resolves.toEqual(first);
    });

    it("keeps a user on their first card and leaves the second one unspent", async () => {
      const { repository, cardHash, userId } = setup();
      const secondCardHash = faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" });
      const otherUserId = faker.string.uuid();
      const first = await repository.claim({ cardHash, userId });

      await expect(repository.claim({ cardHash: secondCardHash, userId })).resolves.toEqual(first);
      await expect(repository.claim({ cardHash: secondCardHash, userId: otherUserId })).resolves.toMatchObject({ userId: otherUserId });
    });

    it("returns a user's own row when they claim a card another account spent", async () => {
      const { repository, cardHash, userId } = setup();
      const otherCardHash = faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" });
      const own = await repository.claim({ cardHash, userId });
      await repository.claim({ cardHash: otherCardHash, userId: faker.string.uuid() });

      await expect(repository.claim({ cardHash: otherCardHash, userId })).resolves.toEqual(own);
    });

    it("gives a card claimed by several users at once to exactly one of them", async () => {
      const { repository, cardHash } = setup();
      const userIds = Array.from({ length: 6 }, () => faker.string.uuid());

      const claims = await Promise.all(userIds.map(userId => repository.claim({ cardHash, userId })));

      const holders = new Set(claims.map(claim => claim.userId));
      expect(holders.size).toBe(1);
      expect(userIds).toContain([...holders][0]);
      const outcomes = await Promise.all(userIds.map(userId => repository.existsForUser(userId)));
      expect(outcomes.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("existsForUser", () => {
    it("tells a user with a card from one without", async () => {
      const { repository, cardHash, userId } = setup();
      await repository.claim({ cardHash, userId });

      await expect(repository.existsForUser(userId)).resolves.toBe(true);
      await expect(repository.existsForUser(faker.string.uuid())).resolves.toBe(false);
    });
  });

  function setup() {
    return {
      repository: container.resolve(TrialCardRepository),
      cardHash: faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" }),
      userId: faker.string.uuid()
    };
  }
});
