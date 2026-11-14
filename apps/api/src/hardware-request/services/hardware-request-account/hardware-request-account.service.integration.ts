import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { HardwareRequestAccountService } from "./hardware-request-account.service";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedPersonalOrganizationIdOf, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(HardwareRequestAccountService.name, () => {
  it("calls a team with its own card paying, whatever the requester's own card", async () => {
    const { service } = setup();
    const { organization: team, user } = await seedOrganizationWithOwner();
    await seedCard({ userId: user.id, organizationId: team.id });

    await expect(service.findAccountType({ userId: user.id, organizationId: team.id })).resolves.toBe("paying");
  });

  it("leaves the requester's own card out of a team's account type", async () => {
    const { service } = setup();
    const { organization: team, user } = await seedOrganizationWithOwner();
    await seedCard({ userId: user.id, organizationId: await seedPersonalOrganizationIdOf(user.id) });
    await seedOrganizationWallet({ organizationId: team.id, isTrialing: true });

    await expect(service.findAccountType({ userId: user.id, organizationId: team.id })).resolves.toBe("trial");
  });

  it("calls a team without a card whose wallet left the trial no_card", async () => {
    const { service } = setup();
    const { organization: team, user } = await seedOrganizationWithOwner();
    await seedOrganizationWallet({ organizationId: team.id, isTrialing: false });

    await expect(service.findAccountType({ userId: user.id, organizationId: team.id })).resolves.toBe("no_card");
  });

  it("reads a personal organization's account type from its owner's card", async () => {
    const { service } = setup();
    const { user, wallet } = await seedUserWithWallet({ isTrialing: true });
    const personalOrganizationId = wallet.organizationId!;
    await seedCard({ userId: user.id, organizationId: personalOrganizationId });

    await expect(service.findAccountType({ userId: user.id, organizationId: personalOrganizationId })).resolves.toBe("paying");
  });

  it.each([
    { isTrialing: true, accountType: "trial" },
    { isTrialing: false, accountType: "no_card" }
  ])("reads a requester without an organization from their own wallet ($accountType)", async ({ isTrialing, accountType }) => {
    const { service } = setup();
    const { user } = await seedUserWithWallet({ isTrialing });

    await expect(service.findAccountType({ userId: user.id, organizationId: null })).resolves.toBe(accountType);
  });

  it("calls a requester without a wallet a trial", async () => {
    const { service } = setup();
    const user = await seedUser();

    await expect(service.findAccountType({ userId: user.id, organizationId: null })).resolves.toBe("trial");
  });

  it("calls a request filed for an email with no account no_account", async () => {
    const { service } = setup();

    await expect(service.findAccountType({ userId: null, organizationId: null })).resolves.toBe("no_account");
  });

  async function seedCard(owner: { userId: string; organizationId: string }) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("PaymentMethods"))
      .values({ ...owner, fingerprint: `fp_${faker.string.alphanumeric(16)}`, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
  }

  function setup() {
    return { service: container.resolve(HardwareRequestAccountService) };
  }
});
