import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { BonusEligibility, FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { Payer } from "@src/billing/services/payer/payer";
import type { PayerService } from "@src/billing/services/payer/payer.service";
import { FirstPurchaseBonusController } from "./first-purchase-bonus.controller";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusController.name, () => {
  describe("getFirstPurchaseBonus", () => {
    it("answers for the team that pays and the member who acts, now", async () => {
      const user = createUser();
      const team = createOrganization({ type: "team" });
      const { controller, firstPurchaseBonusService } = setup({
        payer: { user, organizationId: team.id, team, stripeCustomerId: null },
        eligibility: { eligible: false, endsAt: null, window: null }
      });
      const before = Date.now();

      const result = await controller.getFirstPurchaseBonus();

      expect(result).toEqual({ data: { eligible: false, endsAt: null } });
      expect(firstPurchaseBonusService.evaluate).toHaveBeenCalledWith({ organizationId: team.id }, user.id, expect.any(Date));
      const [, , at] = firstPurchaseBonusService.evaluate.mock.calls[0];
      expect(at.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("answers for the user's own account outside a team, with no deadline when none applies", async () => {
      const user = createUser();
      const { controller, firstPurchaseBonusService } = setup({
        payer: { user, stripeCustomerId: null },
        eligibility: { eligible: true, endsAt: null, window: null }
      });

      const result = await controller.getFirstPurchaseBonus();

      expect(result).toEqual({ data: { eligible: true, endsAt: null } });
      expect(firstPurchaseBonusService.evaluate).toHaveBeenCalledWith({ userId: user.id }, user.id, expect.any(Date));
    });

    it("answers when the open window ends", async () => {
      const user = createUser();
      const { controller } = setup({
        payer: { user, stripeCustomerId: null },
        eligibility: { eligible: true, endsAt: new Date("2026-10-26T18:00:00.000Z"), window: "small_first_purchase" }
      });

      const result = await controller.getFirstPurchaseBonus();

      expect(result).toEqual({ data: { eligible: true, endsAt: "2026-10-26T18:00:00.000Z" } });
    });
  });

  function setup(input: { payer: Payer; eligibility: BonusEligibility }) {
    const payerService = mock<PayerService>();
    payerService.getCurrentPayer.mockResolvedValue(input.payer);
    const firstPurchaseBonusService = mock<FirstPurchaseBonusService>();
    firstPurchaseBonusService.evaluate.mockResolvedValue(input.eligibility);
    container.register(AuthService, { useValue: mock<AuthService>({ currentUser: input.payer.user, isAuthenticated: true }) });

    const controller = new FirstPurchaseBonusController(payerService, firstPurchaseBonusService);

    return { controller, payerService, firstPurchaseBonusService };
  }
});
