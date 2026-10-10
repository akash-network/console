import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services";
import { PaymentMethodRepository } from "./payment-method.repository";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(PaymentMethodRepository.name, () => {
  describe("upsert", () => {
    it("makes a member's first card in a team the team's default although the member has a default card of their own", async () => {
      const { repository, member, team } = await setup();
      const own = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });

      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(own.paymentMethod.isDefault).toBe(true);
      expect(teamCard).toMatchObject({ isNew: true, paymentMethod: { isDefault: true, organizationId: team.id, userId: member.id } });
    });

    it("keeps a second team card off default even when another member adds it", async () => {
      const { repository, member, owner, team } = await setup();
      await repository.upsert({ userId: owner.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      const second = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(second.paymentMethod.isDefault).toBe(false);
    });
  });

  describe("markAsDefault", () => {
    it("moves a user's own default without touching the default of a team the user added a card to", async () => {
      const { repository, member, team } = await setup();
      const first = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      const second = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      const marked = await repository.markAsDefault(second.paymentMethod.paymentMethodId, { userId: member.id });

      expect(marked).toMatchObject({ id: second.paymentMethod.id, isDefault: true });
      expect(await repository.findById(first.paymentMethod.id)).toMatchObject({ isDefault: false });
      expect(await repository.findById(teamCard.paymentMethod.id)).toMatchObject({ isDefault: true });
    });

    it("finds nothing to mark among another owner's cards", async () => {
      const { repository, member, team } = await setup();
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(await repository.markAsDefault(teamCard.paymentMethod.paymentMethodId, { userId: member.id })).toBeUndefined();
    });
  });

  describe("createAsDefault", () => {
    it("makes a new team card the team's default without touching the member's own default", async () => {
      const { repository, member, team } = await setup();
      const own = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      const firstTeamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      const created = await container
        .resolve(TxService)
        .transaction(() => repository.createAsDefault({ owner: { organizationId: team.id }, userId: member.id, organizationId: team.id, ...card() }));

      expect(created).toMatchObject({ isDefault: true, organizationId: team.id });
      expect(await repository.findById(firstTeamCard.paymentMethod.id)).toMatchObject({ isDefault: false });
      expect(await repository.findById(own.paymentMethod.id)).toMatchObject({ isDefault: true });
    });
  });

  describe("findByOwner", () => {
    it("leaves a card not yet filed under any organization out of a team's cards", async () => {
      const { repository, member, team } = await setup();
      await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });

      expect(await repository.findByOwner({ organizationId: team.id })).toEqual([]);
    });

    it("reads a team's cards whoever added them, and a user's own cards without the ones the user added for a team", async () => {
      const { repository, member, owner, team } = await setup();
      const own = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      const byMember = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });
      const byOwner = await repository.upsert({ userId: owner.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      const teamCards = await repository.findByOwner({ organizationId: team.id });
      const memberCards = await repository.findByOwner({ userId: member.id });

      expect(teamCards.map(({ id }) => id).sort()).toEqual([byMember.paymentMethod.id, byOwner.paymentMethod.id].sort());
      expect(memberCards.map(({ id }) => id)).toEqual([own.paymentMethod.id]);
    });
  });

  describe("findDefaultByOwner", () => {
    it("reads the team's default apart from the member's own", async () => {
      const { repository, member, team } = await setup();
      const own = await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(await repository.findDefaultByOwner({ organizationId: team.id })).toMatchObject({ id: teamCard.paymentMethod.id });
      expect(await repository.findDefaultByOwner({ userId: member.id })).toMatchObject({ id: own.paymentMethod.id });
    });
  });

  describe("findOneOwnedBy", () => {
    it("finds a card only among its owner's", async () => {
      const { repository, member, team } = await setup();
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(await repository.findOneOwnedBy({ organizationId: team.id }, teamCard.paymentMethod.paymentMethodId)).toMatchObject({
        id: teamCard.paymentMethod.id
      });
      expect(await repository.findOneOwnedBy({ userId: member.id }, teamCard.paymentMethod.paymentMethodId)).toBeUndefined();
    });
  });

  describe("markAsValidated", () => {
    it("validates the team's card and leaves the same member's own cards alone", async () => {
      const { repository, member, team } = await setup();
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      await repository.markAsValidated(teamCard.paymentMethod.paymentMethodId, { userId: member.id });
      expect(await repository.findById(teamCard.paymentMethod.id)).toMatchObject({ isValidated: false });

      await repository.markAsValidated(teamCard.paymentMethod.paymentMethodId, { organizationId: team.id });
      expect(await repository.findById(teamCard.paymentMethod.id)).toMatchObject({ isValidated: true });
    });
  });

  describe("countByOwner", () => {
    it("counts a team's cards apart from its members' own", async () => {
      const { repository, member, team } = await setup();
      await repository.upsert({ userId: member.id, owner: { userId: member.id }, ...card() });
      await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });
      await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });

      expect(await repository.countByOwner({ organizationId: team.id })).toBe(2);
      expect(await repository.countByOwner({ userId: member.id })).toBe(1);
    });
  });

  describe("deleteByFingerprint", () => {
    it("deletes a card only from its owner and reports whether it did", async () => {
      const { repository, member, team } = await setup();
      const teamCard = await repository.upsert({ userId: member.id, organizationId: team.id, owner: { organizationId: team.id }, ...card() });
      const { fingerprint, paymentMethodId } = teamCard.paymentMethod;

      expect(await repository.deleteByFingerprint(fingerprint, paymentMethodId, { userId: member.id })).toBe(false);
      expect(await repository.deleteByFingerprint(fingerprint, paymentMethodId, { organizationId: team.id })).toBe(true);
      expect(await repository.findById(teamCard.paymentMethod.id)).toBeUndefined();
    });
  });

  function card() {
    return { fingerprint: `fp_${faker.string.alphanumeric(16)}`, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` };
  }

  async function setup() {
    const repository = container.resolve(PaymentMethodRepository);
    const { organization: team, user: owner } = await seedOrganizationWithOwner();
    const member = await seedUser();
    await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "billing" });

    return { repository, team, owner, member };
  }
});
