import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { OrganizationRepository } from "./organization.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(OrganizationRepository.name, () => {
  describe("createPersonalUnlessExists", () => {
    it("creates the user's personal organization once and hands back the same one afterwards", async () => {
      const { repository, user, input } = await setup();

      const first = await repository.createPersonalUnlessExists(input);
      const second = await repository.createPersonalUnlessExists({ ...input, slug: `${input.slug}-again` });

      expect(first).toMatchObject({ isNew: true, organization: { type: "personal", createdByUserId: user.id, name: input.name, slug: input.slug } });
      expect(second).toEqual({ isNew: false, organization: first?.organization });
      expect(await repository.count({ createdByUserId: user.id })).toBe(1);
    });

    it("lets exactly one of two concurrent claims create the organization", async () => {
      const { repository, input } = await setup();

      const claims = await Promise.all([repository.createPersonalUnlessExists(input), repository.createPersonalUnlessExists(input)]);

      expect(claims.map(claim => claim?.isNew).sort()).toEqual([false, true]);
      expect(new Set(claims.map(claim => claim?.organization.id)).size).toBe(1);
    });

    it("hands back nothing when the slug belongs to another organization", async () => {
      const { repository, user, input } = await setup();
      await seedOrganization({ slug: input.slug });

      const claim = await repository.createPersonalUnlessExists(input);

      expect(claim).toBeUndefined();
      expect(await repository.findPersonalByUserId(user.id)).toBeUndefined();
    });
  });

  describe("findPersonalByUserId", () => {
    it("finds the user's personal organization and not the team organizations they created", async () => {
      const { repository, user, input } = await setup();
      await seedOrganization({ createdByUserId: user.id, type: "team" });

      const before = await repository.findPersonalByUserId(user.id);
      const claim = await repository.createPersonalUnlessExists(input);
      const after = await repository.findPersonalByUserId(user.id);

      expect(before).toBeUndefined();
      expect(after).toEqual(claim?.organization);
    });
  });

  async function setup() {
    const repository = container.resolve(OrganizationRepository);
    const user = await seedUser({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(10)}` });
    const input = { createdByUserId: user.id, name: user.username as string, slug: `personal-${faker.string.alphanumeric(12).toLowerCase()}` };

    return { repository, user, input };
  }
});
