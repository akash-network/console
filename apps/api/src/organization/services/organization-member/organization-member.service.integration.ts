import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { LAST_OWNER_ERROR_CODE, OrganizationMemberService } from "./organization-member.service";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(OrganizationMemberService.name, () => {
  describe("assertAnotherOwnerRemains", () => {
    it("lets exactly one of two concurrent demotions of the last two owners through", async () => {
      const { service, repository, txService, organization, owners } = await setup();

      const outcomes = await Promise.allSettled(
        owners.map(owner =>
          txService.transaction(async () => {
            await service.assertAnotherOwnerRemains(organization.id, owner.userId);
            await delay(100);
            await repository.updateBy({ organizationId: organization.id, userId: owner.userId }, { role: "member" });
          })
        )
      );

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(outcomes.find(outcome => outcome.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({ status: 409, errorCode: LAST_OWNER_ERROR_CODE })
      });
      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("lets an owner step down while another owner stays", async () => {
      const { service, repository, txService, organization, owners } = await setup();

      await txService.transaction(async () => {
        await service.assertAnotherOwnerRemains(organization.id, owners[0].userId);
        await repository.updateBy({ organizationId: organization.id, userId: owners[0].userId }, { role: "member" });
      });

      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("refuses to let the last owner step down", async () => {
      const { service, repository, txService, organization, owners } = await setup();
      await repository.updateBy({ organizationId: organization.id, userId: owners[0].userId }, { role: "member" });

      await expect(txService.transaction(() => service.assertAnotherOwnerRemains(organization.id, owners[1].userId))).rejects.toMatchObject({
        status: 409,
        errorCode: LAST_OWNER_ERROR_CODE
      });
    });
  });

  async function setup() {
    const service = container.resolve(OrganizationMemberService);
    const repository = container.resolve(OrganizationMemberRepository);
    const txService = container.resolve(TxService);
    const { organization, membership: first } = await seedOrganizationWithOwner();
    const secondUser = await seedUser();
    const second = await seedOrganizationMember({ organizationId: organization.id, userId: secondUser.id, role: "owner" });

    return { service, repository, txService, organization, owners: [first, second] };
  }
});
