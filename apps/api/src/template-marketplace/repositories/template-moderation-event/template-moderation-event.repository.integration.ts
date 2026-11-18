import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TemplateModerationEventRepository } from "./template-moderation-event.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplateModerationEvent } from "@test/seeders/db/template.seeder";

describe(TemplateModerationEventRepository.name, () => {
  describe("findById", () => {
    it("reads the event as the admin app recorded it", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await seedTemplateModerationEvent({ templateId: template.id, action: "unhide", reason: "Appeal accepted." });
      const event = await seedTemplateModerationEvent({
        templateId: template.id,
        action: "hide",
        staffEmail: "moderator@akash.network",
        reason: "It mines cryptocurrency.",
        details: { reportIds: ["report-1"] }
      });

      expect(await repository.findById(event.id)).toEqual({
        id: event.id,
        templateId: template.id,
        templateVersionId: null,
        organizationId: null,
        action: "hide",
        staffEmail: "moderator@akash.network",
        reason: "It mines cryptocurrency.",
        details: { reportIds: ["report-1"] },
        createdAt: expect.any(Date)
      });
    });

    it("reads an event about a publisher rather than a template", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      const event = await seedTemplateModerationEvent({ organizationId: organization.id, action: "suspend_publisher" });

      expect(await repository.findById(event.id)).toMatchObject({
        templateId: null,
        organizationId: organization.id,
        action: "suspend_publisher",
        details: {}
      });
    });

    it("finds nothing for an id no event has", async () => {
      const { repository } = setup();

      expect(await repository.findById(faker.string.uuid())).toBeUndefined();
    });
  });

  function setup() {
    return { repository: container.resolve(TemplateModerationEventRepository) };
  }
});
