import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ownedBy } from "./billing-owner";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("ownedBy", () => {
  it("reads a user's own payment methods without the team's through the select builder", async () => {
    const { db, member, ownCard } = await setup();
    const paymentMethods = resolveTable("PaymentMethods");

    const rows = await db
      .select()
      .from(paymentMethods)
      .where(ownedBy(paymentMethods, { userId: member.id }));

    expect(rows.map(({ id }) => id)).toEqual([ownCard.id]);
  });

  it("reads a user's own payment methods without the team's through a relational query", async () => {
    const { db, member, ownCard } = await setup();

    const rows = await db.query.PaymentMethods.findMany({ where: ownedBy(resolveTable("PaymentMethods"), { userId: member.id }) });

    expect(rows.map(({ id }) => id)).toEqual([ownCard.id]);
  });

  it("reads a team's payment methods through a relational query", async () => {
    const { db, team, teamCard } = await setup();

    const rows = await db.query.PaymentMethods.findMany({ where: ownedBy(resolveTable("PaymentMethods"), { organizationId: team.id }) });

    expect(rows.map(({ id }) => id)).toEqual([teamCard.id]);
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { organization: team } = await seedOrganizationWithOwner();
    const member = await seedUser();
    await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "billing" });
    const [ownCard, teamCard] = await db
      .insert(resolveTable("PaymentMethods"))
      .values([card(member.id, null), card(member.id, team.id)])
      .returning();

    return { db, team, member, ownCard, teamCard };
  }

  function card(userId: string, organizationId: string | null) {
    return { userId, organizationId, fingerprint: `fp_${faker.string.alphanumeric(16)}`, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` };
  }
});
