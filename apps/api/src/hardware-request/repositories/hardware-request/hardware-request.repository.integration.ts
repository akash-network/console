import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { HardwareRequestRepository } from "./hardware-request.repository";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(HardwareRequestRepository.name, () => {
  describe("claimByContactEmail", () => {
    it("hands the unclaimed requests filed for the address to the account, whatever the address's case and padding", async () => {
      const { repository, email, user, organization } = await setup();
      const unclaimed = await seedHardwareRequest({ userId: null, contactEmail: email.toUpperCase() });

      const claimed = await repository.claimByContactEmail(` ${email} `, { userId: user.id, organizationId: organization.id });

      expect(claimed).toMatchObject([{ id: unclaimed.id, userId: user.id, organizationId: organization.id }]);
      expect(await repository.findById(unclaimed.id)).toMatchObject({ userId: user.id, organizationId: organization.id });
    });

    it("leaves requests that already have a user, or another address, alone", async () => {
      const { repository, email, user, organization } = await setup();
      const someoneElse = await seedUser();
      const owned = await seedHardwareRequest({ userId: someoneElse.id, contactEmail: email });
      const otherAddress = await seedHardwareRequest({ userId: null, contactEmail: faker.internet.email() });

      await expect(repository.claimByContactEmail(email, { userId: user.id, organizationId: organization.id })).resolves.toEqual([]);
      expect(await repository.findById(owned.id)).toMatchObject({ userId: someoneElse.id });
      expect(await repository.findById(otherAddress.id)).toMatchObject({ userId: null });
    });
  });

  async function setup() {
    const { user, organization } = await seedOrganizationWithOwner();

    return {
      repository: container.resolve(HardwareRequestRepository).unscoped("gpu-request-claim"),
      email: faker.internet.email().toLowerCase(),
      user,
      organization
    };
  }
});
