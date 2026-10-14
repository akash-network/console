import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingDetailsInput } from "@src/billing/http-schemas/billing-details.schema";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import { BillingDetailsService, INVALID_TAX_ID_ERROR_CODE, INVALID_TAX_ID_MESSAGE } from "./billing-details.service";

import { createUserPayer } from "@test/seeders/payer.seeder";
import { createStripeAddress, createStripeCustomer, createStripeTaxId } from "@test/seeders/stripe-customer.seeder";

describe(BillingDetailsService.name, () => {
  describe("getBillingDetails", () => {
    it("returns empty details without calling Stripe when the payer has no customer yet", async () => {
      const { service, stripe } = setup();
      const retrieve = vi.spyOn(stripe.customers, "retrieve");

      const result = await service.getBillingDetails({ stripeCustomerId: null });

      expect(result).toEqual({ legalName: null, address: null, taxId: null });
      expect(retrieve).not.toHaveBeenCalled();
    });

    it("returns the customer's name, address and first tax ID", async () => {
      const { service, stripe } = setup();
      const address = createStripeAddress();
      const taxId = createStripeTaxId({
        type: "eu_vat",
        value: "DE123456789",
        verification: { status: "pending", verified_address: null, verified_name: null }
      });
      const customer = createStripeCustomer({
        name: "Acme GmbH",
        address,
        tax_ids: { object: "list", data: [taxId, createStripeTaxId()], has_more: false, url: "" }
      });
      const retrieve = vi.spyOn(stripe.customers, "retrieve").mockResolvedValue(customer);

      const result = await service.getBillingDetails({ stripeCustomerId: customer.id });

      expect(retrieve).toHaveBeenCalledWith(customer.id, { expand: ["tax_ids"] });
      expect(result).toEqual({
        legalName: "Acme GmbH",
        address: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postal_code,
          country: address.country
        },
        taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "pending" }
      });
    });

    it("returns null fields for a customer with no name, address or tax ID", async () => {
      const { service, stripe } = setup();
      const customer = createStripeCustomer({ name: null, address: null, tax_ids: undefined });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue(customer);

      const result = await service.getBillingDetails({ stripeCustomerId: customer.id });

      expect(result).toEqual({ legalName: null, address: null, taxId: null });
    });

    it("reports no verification status for a tax ID type Stripe does not verify", async () => {
      const { service, stripe } = setup();
      const taxId = createStripeTaxId({ type: "us_ein", value: "12-3456789", verification: null });
      const customer = createStripeCustomer({ tax_ids: { object: "list", data: [taxId], has_more: false, url: "" } });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue(customer);

      const result = await service.getBillingDetails({ stripeCustomerId: customer.id });

      expect(result.taxId).toEqual({ type: "us_ein", value: "12-3456789", verificationStatus: null });
    });

    it("returns empty details when the customer was deleted in Stripe", async () => {
      const { service, stripe } = setup();
      const customerId = `cus_${faker.string.alphanumeric(14)}`;
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        id: customerId,
        object: "customer",
        deleted: true,
        lastResponse: { headers: {}, requestId: "req_1", statusCode: 200 }
      });

      const result = await service.getBillingDetails({ stripeCustomerId: customerId });

      expect(result).toEqual({ legalName: null, address: null, taxId: null });
    });
  });

  describe("updateBillingDetails", () => {
    it("saves the legal name and address on the payer's customer, sending cleared fields as empty strings", async () => {
      const { service, stripe, customerService, payer, customerId } = setup();
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));

      await service.updateBillingDetails(
        payer,
        createInput({ legalName: "Acme GmbH", address: { line1: "Hauptstr. 1", line2: null, city: null, state: null, postalCode: null, country: "DE" } })
      );

      expect(customerService.getStripeCustomerId).toHaveBeenCalledWith(payer);
      expect(update).toHaveBeenCalledWith(customerId, {
        name: "Acme GmbH",
        address: { line1: "Hauptstr. 1", line2: "", city: "", state: "", postal_code: "", country: "DE" },
        expand: ["tax_ids"]
      });
    });

    it("sends every address field it was given", async () => {
      const { service, stripe, payer, customerId } = setup();
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));

      await service.updateBillingDetails(
        payer,
        createInput({ address: { line1: "1 Main St", line2: "Suite 2", city: "Springfield", state: "IL", postalCode: "62701", country: "US" } })
      );

      expect(update).toHaveBeenCalledWith(customerId, {
        name: expect.any(String),
        address: { line1: "1 Main St", line2: "Suite 2", city: "Springfield", state: "IL", postal_code: "62701", country: "US" },
        expand: ["tax_ids"]
      });
    });

    it("leaves the tax IDs on file untouched when no tax ID is sent", async () => {
      const { service, stripe, payer, customerId } = setup();
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));
      const listTaxIds = stubTaxIds(stripe, [createStripeTaxId({ type: "de_stn" })]);
      const createTaxId = vi.spyOn(stripe.customers, "createTaxId");
      const deleteTaxId = stubDeleteTaxId(stripe);

      await service.updateBillingDetails(payer, createInput());

      expect(update).toHaveBeenCalled();
      expect(listTaxIds).not.toHaveBeenCalled();
      expect(createTaxId).not.toHaveBeenCalled();
      expect(deleteTaxId).not.toHaveBeenCalled();
    });

    it("returns the saved details with the tax ID now on file", async () => {
      const { service, stripe, payer, customerId } = setup();
      const address = createStripeAddress();
      const created = createStripeTaxId({
        type: "gb_vat",
        value: "GB123456789",
        verification: { status: "verified", verified_address: null, verified_name: null }
      });
      vi.spyOn(stripe.customers, "update").mockResolvedValue(
        createStripeCustomer({ id: customerId, name: "Acme GmbH", address, tax_ids: createTaxIdList([created]) })
      );
      stubTaxIds(stripe, []);
      vi.spyOn(stripe.customers, "createTaxId").mockResolvedValue(created);

      const result = await service.updateBillingDetails(payer, createInput({ taxId: { type: "gb_vat", value: "GB123456789" } }));

      expect(result).toEqual({
        legalName: "Acme GmbH",
        address: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postal_code,
          country: address.country
        },
        taxId: { type: "gb_vat", value: "GB123456789", verificationStatus: "verified" }
      });
    });

    it("adds the new tax ID and then removes the ones it replaces", async () => {
      const { service, stripe, payer, customerId } = setup();
      vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));
      const previous = [createStripeTaxId({ type: "eu_vat", value: "DE111111111" }), createStripeTaxId({ type: "ch_vat", value: "CHE-123.456.789 MWST" })];
      const listTaxIds = stubTaxIds(stripe, previous);
      const createTaxId = vi.spyOn(stripe.customers, "createTaxId").mockResolvedValue(createStripeTaxId({ type: "eu_vat", value: "DE222222222" }));
      const deleteTaxId = stubDeleteTaxId(stripe);

      await service.updateBillingDetails(payer, createInput({ taxId: { type: "eu_vat", value: "DE222222222" } }));

      expect(listTaxIds).toHaveBeenCalledWith(customerId, { limit: 100 });
      expect(createTaxId).toHaveBeenCalledWith(customerId, { type: "eu_vat", value: "DE222222222" });
      expect(deleteTaxId).toHaveBeenCalledTimes(2);
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, previous[0].id);
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, previous[1].id);
      expect(createTaxId.mock.invocationCallOrder[0]).toBeLessThan(deleteTaxId.mock.invocationCallOrder[0]);
    });

    it("keeps a tax ID that is already on file instead of adding it again", async () => {
      const { service, stripe, payer, customerId } = setup();
      vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));
      const kept = createStripeTaxId({ type: "eu_vat", value: "DE123456789" });
      const other = createStripeTaxId({ type: "gb_vat", value: "GB123456789" });
      stubTaxIds(stripe, [other, kept]);
      const createTaxId = vi.spyOn(stripe.customers, "createTaxId");
      const deleteTaxId = stubDeleteTaxId(stripe);

      await service.updateBillingDetails(payer, createInput({ taxId: { type: "eu_vat", value: "DE123456789" } }));

      expect(createTaxId).not.toHaveBeenCalled();
      expect(deleteTaxId).toHaveBeenCalledTimes(1);
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, other.id);
    });

    it.each([
      { change: "value", existing: { type: "eu_vat" as const, value: "DE111111111" } },
      { change: "type", existing: { type: "gb_vat" as const, value: "DE222222222" } }
    ])("replaces a tax ID on file whose $change differs", async ({ existing }) => {
      const { service, stripe, payer, customerId } = setup();
      vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));
      const previous = createStripeTaxId(existing);
      stubTaxIds(stripe, [previous]);
      const createTaxId = vi.spyOn(stripe.customers, "createTaxId").mockResolvedValue(createStripeTaxId({ type: "eu_vat", value: "DE222222222" }));
      const deleteTaxId = stubDeleteTaxId(stripe);

      await service.updateBillingDetails(payer, createInput({ taxId: { type: "eu_vat", value: "DE222222222" } }));

      expect(createTaxId).toHaveBeenCalledWith(customerId, { type: "eu_vat", value: "DE222222222" });
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, previous.id);
    });

    it("removes every tax ID on file when the tax ID is cleared", async () => {
      const { service, stripe, payer, customerId } = setup();
      vi.spyOn(stripe.customers, "update").mockResolvedValue(createStripeCustomer({ id: customerId }));
      const previous = [createStripeTaxId(), createStripeTaxId()];
      stubTaxIds(stripe, previous);
      const createTaxId = vi.spyOn(stripe.customers, "createTaxId");
      const deleteTaxId = stubDeleteTaxId(stripe);

      const result = await service.updateBillingDetails(payer, createInput({ taxId: null }));

      expect(createTaxId).not.toHaveBeenCalled();
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, previous[0].id);
      expect(deleteTaxId).toHaveBeenCalledWith(customerId, previous[1].id);
      expect(result.taxId).toBeNull();
    });

    it("rejects a tax ID Stripe finds invalid without touching the customer or the tax IDs on file", async () => {
      const { service, stripe, payer } = setup();
      const update = vi.spyOn(stripe.customers, "update");
      stubTaxIds(stripe, [createStripeTaxId()]);
      vi.spyOn(stripe.customers, "createTaxId").mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "tax_id_invalid", message: "Invalid value for eu_vat." })
      );
      const deleteTaxId = stubDeleteTaxId(stripe);

      await expect(service.updateBillingDetails(payer, createInput({ taxId: { type: "eu_vat", value: "DE1" } }))).rejects.toMatchObject({
        status: 400,
        message: INVALID_TAX_ID_MESSAGE,
        errorCode: INVALID_TAX_ID_ERROR_CODE
      });
      expect(deleteTaxId).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it("lets any other Stripe error through", async () => {
      const { service, stripe, payer } = setup();
      stubTaxIds(stripe, []);
      const error = new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "resource_missing", message: "No such customer" });
      vi.spyOn(stripe.customers, "createTaxId").mockRejectedValue(error);

      await expect(service.updateBillingDetails(payer, createInput({ taxId: { type: "eu_vat", value: "DE123456789" } }))).rejects.toBe(error);
    });
  });

  function stubTaxIds(stripe: Stripe, taxIds: Stripe.TaxId[]) {
    return vi.spyOn(stripe.customers, "listTaxIds").mockReturnValue(
      Promise.resolve({
        object: "list",
        data: taxIds,
        has_more: false,
        url: "",
        lastResponse: { headers: {}, requestId: "req_1", statusCode: 200 }
      }) as Stripe.ApiListPromise<Stripe.TaxId>
    );
  }

  function createTaxIdList(taxIds: Stripe.TaxId[]): Stripe.ApiList<Stripe.TaxId> {
    return { object: "list", data: taxIds, has_more: false, url: "" };
  }

  function stubDeleteTaxId(stripe: Stripe) {
    return vi.spyOn(stripe.customers, "deleteTaxId").mockImplementation(async (_customerId, id) => ({
      id,
      object: "tax_id",
      deleted: true,
      lastResponse: { headers: {}, requestId: "req_1", statusCode: 200 }
    }));
  }

  function createInput(overrides: Partial<BillingDetailsInput> = {}): BillingDetailsInput {
    return {
      legalName: faker.company.name(),
      address: {
        line1: faker.location.streetAddress(),
        line2: null,
        city: faker.location.city(),
        state: null,
        postalCode: faker.location.zipCode(),
        country: "DE"
      },
      ...overrides
    };
  }

  function setup() {
    const payer = createUserPayer();
    const customerId = payer.stripeCustomerId;
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    const customerService = mock<CustomerService>();
    customerService.getStripeCustomerId.mockResolvedValue(customerId);
    const service = new BillingDetailsService(stripe, customerService);

    return { service, stripe, customerService, payer, customerId };
  }
});
