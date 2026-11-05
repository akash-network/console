import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AssistantConsentRepository } from "./assistant-consent.repository";

import { seedAssistantConsent } from "@test/seeders/db/feedback.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AssistantConsentRepository.name, () => {
  describe("findLatestByUserId", () => {
    it("answers the user's most recent consent row", async () => {
      const { repository, userId } = await setup();
      const other = await seedUser();
      await seedAssistantConsent({ userId, copyVersion: "v1", createdAt: new Date("2026-10-01T00:00:00.000Z") });
      const latest = await seedAssistantConsent({ userId, copyVersion: "v2", createdAt: new Date("2026-10-05T00:00:00.000Z") });
      await seedAssistantConsent({ userId: other.id, copyVersion: "v3", createdAt: new Date("2026-10-09T00:00:00.000Z") });

      expect(await repository.findLatestByUserId(userId)).toEqual(latest);
    });

    it("answers nothing for a user who never agreed", async () => {
      const { repository, userId } = await setup();

      expect(await repository.findLatestByUserId(userId)).toBeUndefined();
    });
  });

  async function setup() {
    const user = await seedUser();

    return { repository: container.resolve(AssistantConsentRepository), userId: user.id };
  }
});
