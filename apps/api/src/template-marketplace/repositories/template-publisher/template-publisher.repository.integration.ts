import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { TemplatePublisherRepository } from "./template-publisher.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(TemplatePublisherRepository.name, () => {
  describe("findByOrganizationId", () => {
    it("returns the publisher of that organization, or nothing before it first publishes", async () => {
      const { repository } = setup();
      const [published, other, unpublished] = await Promise.all([seedOrganization(), seedOrganization(), seedOrganization()]);
      const handle = createHandle();
      await repository.findOrCreate(published.id, [handle]);
      await repository.findOrCreate(other.id, [createHandle()]);

      expect(await repository.findByOrganizationId(published.id)).toEqual({
        organizationId: published.id,
        handle,
        bio: null,
        links: [],
        isVerified: false,
        publishingSuspendedAt: null,
        publishingSuspendedReason: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
      expect(await repository.findByOrganizationId(unpublished.id)).toBeUndefined();
    });
  });

  describe("findPublishingOrganization", () => {
    it("describes a team by its name and slug, with the username of whoever created it", async () => {
      const { repository } = setup();
      const creator = await seedUser({ username: `sam-${faker.string.alphanumeric(8)}` });
      const team = await seedOrganization({ createdByUserId: creator.id });

      expect(await repository.findPublishingOrganization(team.id)).toEqual({
        name: team.name,
        slug: team.slug,
        type: "team",
        ownerUsername: creator.username
      });
    });

    it("describes a personal organization with its owner's username", async () => {
      const { repository } = setup();
      const owner = await seedUser({ username: `sam-${faker.string.alphanumeric(8)}` });
      const personal = await seedPersonalOrganizationOf(owner);

      expect(await repository.findPublishingOrganization(personal.id)).toMatchObject({ type: "personal", ownerUsername: owner.username });
    });

    it("names no owner for an organization whose creator is gone, and nothing for an unknown organization", async () => {
      const { repository } = setup();
      const team = await seedOrganization();

      expect(await repository.findPublishingOrganization(team.id)).toMatchObject({ name: team.name, ownerUsername: null });
      expect(await repository.findPublishingOrganization(faker.string.uuid())).toBeUndefined();
    });
  });

  describe("findOrCreate", () => {
    it("creates the publisher under the first handle offered", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      const [first, second] = [createHandle(), createHandle()];

      const publisher = await repository.findOrCreate(organization.id, [first, second]);

      expect(publisher).toMatchObject({ organizationId: organization.id, handle: first });
    });

    it("moves to the next handle when another organization holds the first", async () => {
      const { repository } = setup();
      const [holder, organization] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [taken, free] = [createHandle(), createHandle()];
      await repository.findOrCreate(holder.id, [taken]);

      const publisher = await repository.findOrCreate(organization.id, [taken, free]);

      expect(publisher).toMatchObject({ organizationId: organization.id, handle: free });
      expect(await repository.findByOrganizationId(holder.id)).toMatchObject({ handle: taken });
    });

    it("keeps the handle of an organization that already published, whatever is offered", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      const original = createHandle();
      const created = await repository.findOrCreate(organization.id, [original]);

      const found = await repository.findOrCreate(organization.id, [createHandle()]);

      expect(found).toEqual(created);
    });

    it("leaves the surrounding transaction usable after a handle turned out taken", async () => {
      const { repository } = setup();
      const [holder, organization] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [taken, free] = [createHandle(), createHandle()];
      await repository.findOrCreate(holder.id, [taken]);

      const publisher = await container.resolve(TxService).transaction(async () => {
        await repository.findOrCreate(organization.id, [taken, free]);

        return await repository.findByOrganizationId(organization.id);
      });

      expect(publisher).toMatchObject({ handle: free });
    });

    it("fails once every handle offered is held by another organization", async () => {
      const { repository } = setup();
      const [holder, organization] = await Promise.all([seedOrganization(), seedOrganization()]);
      const taken = createHandle();
      await repository.findOrCreate(holder.id, [taken]);

      await expect(repository.findOrCreate(organization.id, [taken])).rejects.toThrow(`No free publisher handle for organization ${organization.id}`);
    });

    it("refuses a handle that is not lowercase and url-safe", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();

      await expect(repository.findOrCreate(organization.id, ["Not A Handle"])).rejects.toThrow();
    });

    it("removes the publisher with its organization", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      await repository.findOrCreate(organization.id, [createHandle()]);
      const organizations = resolveTable("Organizations");

      await container.resolve<ApiPgDatabase>(POSTGRES_DB).delete(organizations).where(eq(organizations.id, organization.id));

      expect(await repository.findByOrganizationId(organization.id)).toBeUndefined();
    });
  });

  function createHandle() {
    return `acme-${faker.string.alphanumeric(12).toLowerCase()}`;
  }

  function setup() {
    return { repository: container.resolve(TemplatePublisherRepository) };
  }
});
