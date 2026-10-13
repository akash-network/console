import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { InvitationEmailLimiter } from "./invitation-email-limiter.service";

import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";

describe(InvitationEmailLimiter.name, () => {
  describe("assertWithinLimits", () => {
    it("lets rows that reference the organization be written while its locks are held", async () => {
      const limiter = container.resolve(InvitationEmailLimiter);
      const txService = container.resolve(TxService);
      const { organization, user } = await seedOrganizationWithOwner();
      let released = false;

      const holding = txService.transaction(async () => {
        await limiter.assertWithinLimits({ organizationId: organization.id, senderId: user.id, emails: ["jane@example.com"] });
        await delay(1_000);
        released = true;
      });
      await delay(100);
      const project = await seedProject({ organizationId: organization.id });

      expect(project.organizationId).toBe(organization.id);
      expect(released).toBe(false);
      await holding;
    });
  });
});
