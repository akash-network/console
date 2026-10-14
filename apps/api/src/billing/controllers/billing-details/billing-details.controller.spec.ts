import createError from "http-errors";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { BillingDetailsInput, BillingDetailsOutput } from "@src/billing/http-schemas/billing-details.schema";
import type { BillingDetailsService } from "@src/billing/services/billing-details/billing-details.service";
import type { PayerService } from "@src/billing/services/payer/payer.service";
import { BillingDetailsController } from "./billing-details.controller";

import { createTeamPayer } from "@test/seeders/payer.seeder";

describe(BillingDetailsController.name, () => {
  describe("getBillingDetails", () => {
    it("returns the billing details of the current payer", async () => {
      const { controller, billingDetailsService, payer } = setup();
      billingDetailsService.getBillingDetails.mockResolvedValue(DETAILS);

      const result = await controller.getBillingDetails();

      expect(billingDetailsService.getBillingDetails).toHaveBeenCalledWith(payer);
      expect(result).toEqual({ data: DETAILS });
    });

    it("refuses a caller who cannot read payment methods", async () => {
      const { controller, billingDetailsService } = setup({ deniedRule: "read:PaymentMethod" });

      await expect(Promise.resolve().then(() => controller.getBillingDetails())).rejects.toMatchObject({ status: 403 });
      expect(billingDetailsService.getBillingDetails).not.toHaveBeenCalled();
    });
  });

  describe("updateBillingDetails", () => {
    it("saves the billing details for the current payer and returns them", async () => {
      const { controller, billingDetailsService, payer } = setup();
      billingDetailsService.updateBillingDetails.mockResolvedValue(DETAILS);

      const result = await controller.updateBillingDetails({ data: INPUT });

      expect(billingDetailsService.updateBillingDetails).toHaveBeenCalledWith(payer, INPUT);
      expect(result).toEqual({ data: DETAILS });
    });

    it("refuses a caller who cannot update payment methods", async () => {
      const { controller, billingDetailsService } = setup({ deniedRule: "update:PaymentMethod" });

      await expect(Promise.resolve().then(() => controller.updateBillingDetails({ data: INPUT }))).rejects.toMatchObject({ status: 403 });
      expect(billingDetailsService.updateBillingDetails).not.toHaveBeenCalled();
    });
  });

  const INPUT: BillingDetailsInput = {
    legalName: "Acme GmbH",
    address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
    taxId: { type: "eu_vat", value: "DE123456789" }
  };

  const DETAILS: BillingDetailsOutput = {
    legalName: "Acme GmbH",
    address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
    taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "pending" }
  };

  function setup(input: { deniedRule?: string } = {}) {
    const payer = createTeamPayer();
    const payerService = mock<PayerService>();
    payerService.getCurrentPayer.mockResolvedValue(payer);
    const billingDetailsService = mock<BillingDetailsService>();
    const authService = mock<AuthService>({ isAuthenticated: true });
    authService.throwUnlessCan.mockImplementation((action, subject) => {
      if (`${action}:${subject}` === input.deniedRule) {
        throw createError(403);
      }
    });
    container.register(AuthService, { useValue: authService });
    const controller = new BillingDetailsController(payerService, billingDetailsService);

    return { controller, payerService, billingDetailsService, authService, payer };
  }
});
