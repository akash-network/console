import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { Payer } from "@src/billing/services/payer/payer";
import type { PayerService } from "@src/billing/services/payer/payer.service";
import { FirstPurchaseBonusController } from "./first-purchase-bonus.controller";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusController.name, () => {
  describe("getFirstPurchaseBonus", () => {
    it("answers for the team that pays and the member who acts", async () => {
      const user = createUser();
      const team = createOrganization({ type: "team" });
      const { controller, firstPurchaseBonusService } = setup({ payer: { user, organizationId: team.id, team, stripeCustomerId: null }, isEligible: false });

      const result = await controller.getFirstPurchaseBonus();

      expect(result).toEqual({ data: { eligible: false } });
      expect(firstPurchaseBonusService.isEligible).toHaveBeenCalledWith({ organizationId: team.id }, user.id);
    });

    it("answers for the user's own account outside a team", async () => {
      const user = createUser();
      const { controller, firstPurchaseBonusService } = setup({ payer: { user, stripeCustomerId: null }, isEligible: true });

      const result = await controller.getFirstPurchaseBonus();

      expect(result).toEqual({ data: { eligible: true } });
      expect(firstPurchaseBonusService.isEligible).toHaveBeenCalledWith({ userId: user.id }, user.id);
    });
  });

  function setup(input: { payer: Payer; isEligible: boolean }) {
    const payerService = mock<PayerService>();
    payerService.getCurrentPayer.mockResolvedValue(input.payer);
    const firstPurchaseBonusService = mock<FirstPurchaseBonusService>();
    firstPurchaseBonusService.isEligible.mockResolvedValue(input.isEligible);
    container.register(AuthService, { useValue: mock<AuthService>({ currentUser: input.payer.user, isAuthenticated: true }) });

    const controller = new FirstPurchaseBonusController(payerService, firstPurchaseBonusService);

    return { controller, payerService, firstPurchaseBonusService };
  }
});
