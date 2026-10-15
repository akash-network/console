import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

describe(RefillService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("topUpWallet", () => {
    it("holds a team's credit behind a deletion that has locked the team's wallet, then refuses it once the deletion commits", async () => {
      const { team, owner, wallet, authorizeSpending } = await setup();
      const deletion = holdTransaction(async () => {
        await container.resolve(OrganizationRepository).findOneByAndLock({ id: team.id });
        await container.resolve(UserWalletRepository).findOneByAndLock({ id: wallet.id });
        await container.resolve(OrganizationRepository).updateById(team.id, { deletedAt: new Date() });
      });
      await deletion.held;

      const crediting = container
        .resolve(TxService)
        .transaction(() => container.resolve(RefillService).topUpWallet(1000, { userId: owner.id, organizationId: team.id, team }));
      await waitForLockWait('select %from "user_wallets"%for update');
      deletion.release();
      await deletion.committed;

      await expect(crediting).rejects.toMatchObject({ status: 409, errorCode: "organization_deleted" });
      expect(authorizeSpending).not.toHaveBeenCalled();
    });
  });

  async function setup() {
    const { organization: team, user: owner } = await seedOrganizationWithOwner();
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: team.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();
    const authorizeSpending = vi.spyOn(container.resolve(ManagedUserWalletService), "authorizeSpending").mockResolvedValue();

    return { team, owner, wallet, authorizeSpending };
  }
});
