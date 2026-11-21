import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { TemplateTermsAcceptanceRepository } from "./template-terms-acceptance.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(TemplateTermsAcceptanceRepository.name, () => {
  describe("record", () => {
    it("records who accepted which terms for which template, and when", async () => {
      const { repository, user, organization, template } = await setup();

      await repository.record({ templateId: template.id, userId: user.id, organizationId: organization.id, termsVersion: "2026-11" });

      expect(await acceptancesOf(template.id)).toEqual([
        {
          id: expect.any(String),
          templateId: template.id,
          userId: user.id,
          organizationId: organization.id,
          termsVersion: "2026-11",
          acceptedAt: expect.any(Date)
        }
      ]);
    });

    it("keeps one acceptance for each time the template is published", async () => {
      const { repository, user, organization, template } = await setup();

      await repository.record({ templateId: template.id, userId: user.id, organizationId: organization.id, termsVersion: "2026-11" });
      await repository.record({ templateId: template.id, userId: user.id, organizationId: organization.id, termsVersion: "2027-01" });

      expect((await acceptancesOf(template.id)).map(acceptance => acceptance.termsVersion).sort()).toEqual(["2026-11", "2027-01"]);
    });

    it("keeps the acceptance without its user once the account is deleted, and drops it with the template", async () => {
      const { repository, user, organization, template } = await setup();
      await repository.record({ templateId: template.id, userId: user.id, organizationId: organization.id, termsVersion: "2026-11" });

      await container.resolve(UserRepository).deleteById(user.id);
      const afterAccountDeletion = await acceptancesOf(template.id);
      const templates = resolveTable("Templates");
      await container.resolve<ApiPgDatabase>(POSTGRES_DB).delete(templates).where(eq(templates.id, template.id));

      expect(afterAccountDeletion).toEqual([expect.objectContaining({ userId: null, termsVersion: "2026-11" })]);
      expect(await acceptancesOf(template.id)).toEqual([]);
    });
  });

  async function acceptancesOf(templateId: string) {
    const acceptances = resolveTable("TemplateTermsAcceptances");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(acceptances).where(eq(acceptances.templateId, templateId));
  }

  async function setup() {
    const [user, organization] = await Promise.all([seedUser(), seedOrganization()]);
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({ organizationId: organization.id, title: faker.lorem.words(3), sdl: "version: '2.0'", cpu: 1000, ram: 1024, storage: 1024 })
      .returning();

    return { repository: container.resolve(TemplateTermsAcceptanceRepository), user, organization, template };
  }
});
