import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const STRIPE_API = "https://api.stripe.com";

describe("Billing details", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it.each([
    { method: "GET", body: undefined },
    { method: "PUT", body: JSON.stringify({ data: {} }) }
  ])("answers $method with 404 while invoices are turned off", async ({ method, body }) => {
    const { owner, headersOf } = await setup({ invoicesEnabled: false });

    const response = await app.request("/v1/billing-details", { method, body, headers: { "Content-Type": "application/json", ...headersOf(owner) } });

    expect(response.status).toBe(404);
  });

  describe("GET /v1/billing-details", () => {
    it("returns empty details without calling Stripe for an account that has not set up payments", async () => {
      const { owner, headersOf } = await setup();
      const stripeCalls = nock(STRIPE_API).get(/.*/).reply(200, {});

      const response = await app.request("/v1/billing-details", { headers: headersOf(owner) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { legalName: null, address: null, taxId: null } });
      expect(stripeCalls.isDone()).toBe(false);
    });

    it("lets an admin read the team's billing details", async () => {
      const { team, headersOf, memberWith } = await setup();
      const admin = await memberWith("admin");
      const customerId = await setTeamCustomer(team.id);
      nock(STRIPE_API)
        .get(`/v1/customers/${customerId}`)
        .query({ "expand[0]": "tax_ids" })
        .reply(200, {
          id: customerId,
          object: "customer",
          name: "Acme GmbH",
          address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postal_code: "10115", country: "DE" },
          tax_ids: { object: "list", data: [taxIdOf(customerId, { id: "txi_1", value: "DE123456789", status: "verified" })], has_more: false }
        });

      const response = await app.request("/v1/billing-details", { headers: headersOf(admin) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          legalName: "Acme GmbH",
          address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
          taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "verified" }
        }
      });
    });
  });

  describe("PUT /v1/billing-details", () => {
    it("lets a billing member set the team's legal name, address and VAT number", async () => {
      const { team, headersOf, memberWith } = await setup();
      const billingMember = await memberWith("billing");
      const customerId = await setTeamCustomer(team.id);
      nock(STRIPE_API)
        .get(`/v1/customers/${customerId}/tax_ids`)
        .query({ limit: "100" })
        .reply(200, { object: "list", data: [taxIdOf(customerId, { id: "txi_old", value: "DE111111111", status: "verified" })], has_more: false });
      const taxIdCreated = nock(STRIPE_API)
        .post(`/v1/customers/${customerId}/tax_ids`, body => body.type === "eu_vat" && body.value === "DE123456789")
        .reply(200, taxIdOf(customerId, { id: "txi_new", value: "DE123456789", status: "pending" }));
      const oldTaxIdDeleted = nock(STRIPE_API)
        .delete(`/v1/customers/${customerId}/tax_ids/txi_old`)
        .reply(200, { id: "txi_old", object: "tax_id", deleted: true });
      const customerUpdated = nock(STRIPE_API)
        .post(
          `/v1/customers/${customerId}`,
          body =>
            body.name === "Acme GmbH" &&
            body["address[line1]"] === "Hauptstr. 1" &&
            body["address[line2]"] === "" &&
            body["address[city]"] === "Berlin" &&
            body["address[state]"] === "" &&
            body["address[postal_code]"] === "10115" &&
            body["address[country]"] === "DE" &&
            body["expand[0]"] === "tax_ids"
        )
        .reply(200, {
          id: customerId,
          object: "customer",
          name: "Acme GmbH",
          address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postal_code: "10115", country: "DE" },
          tax_ids: { object: "list", data: [taxIdOf(customerId, { id: "txi_new", value: "DE123456789", status: "pending" })], has_more: false }
        });

      const response = await putBillingDetails(headersOf(billingMember), VALID_INPUT);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          legalName: "Acme GmbH",
          address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
          taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "pending" }
        }
      });
      expect(taxIdCreated.isDone()).toBe(true);
      expect(oldTaxIdDeleted.isDone()).toBe(true);
      expect(customerUpdated.isDone()).toBe(true);
    });

    it("refuses an admin, who may read the team's billing but not change it", async () => {
      const { team, headersOf, memberWith } = await setup();
      const admin = await memberWith("admin");
      await setTeamCustomer(team.id);

      const response = await putBillingDetails(headersOf(admin), VALID_INPUT);

      expect(response.status).toBe(403);
    });

    it("answers 400 when Stripe rejects the VAT number", async () => {
      const { team, headersOf } = await setup();
      const customerId = await setTeamCustomer(team.id);
      nock(STRIPE_API).get(`/v1/customers/${customerId}/tax_ids`).query(true).reply(200, { object: "list", data: [], has_more: false });
      nock(STRIPE_API)
        .post(`/v1/customers/${customerId}/tax_ids`)
        .reply(400, { error: { type: "invalid_request_error", code: "tax_id_invalid", param: "value", message: "Invalid value for eu_vat." } });
      const customerUpdate = nock(STRIPE_API).post(`/v1/customers/${customerId}`).reply(200, { id: customerId, object: "customer" });

      const response = await putBillingDetails(headersOf(team.owner), { ...VALID_INPUT, taxId: { type: "eu_vat", value: "DE1" } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ message: "This tax ID is not valid for the selected type", code: "invalid_tax_id" });
      expect(customerUpdate.isDone()).toBe(false);
    });

    it("answers 400 without calling Stripe for a country that is not a two-letter code", async () => {
      const { team, headersOf } = await setup();
      await setTeamCustomer(team.id);
      const stripeCalls = nock(STRIPE_API).get(/.*/).reply(200, {});

      const response = await putBillingDetails(headersOf(team.owner), { ...VALID_INPUT, address: { ...VALID_INPUT.address, country: "Germany" } });

      expect(response.status).toBe(400);
      expect(stripeCalls.isDone()).toBe(false);
    });
  });

  const VALID_INPUT = {
    legalName: "Acme GmbH",
    address: { line1: "Hauptstr. 1", line2: null, city: "Berlin", state: null, postalCode: "10115", country: "DE" },
    taxId: { type: "eu_vat", value: "DE123456789" }
  };

  function taxIdOf(customerId: string, input: { id: string; value: string; status: string }) {
    return {
      id: input.id,
      object: "tax_id",
      country: "DE",
      customer: customerId,
      type: "eu_vat",
      value: input.value,
      verification: { status: input.status, verified_address: null, verified_name: null }
    };
  }

  async function putBillingDetails(headers: Record<string, string>, data: unknown) {
    return await app.request("/v1/billing-details", {
      method: "PUT",
      body: JSON.stringify({ data }),
      headers: { "Content-Type": "application/json", ...headers }
    });
  }

  async function setTeamCustomer(organizationId: string) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    await db
      .update(resolveTable("Organizations"))
      .set({ stripeCustomerId })
      .where(eq(resolveTable("Organizations").id, organizationId));

    return stripeCustomerId;
  }

  async function setup(input: { invoicesEnabled?: boolean } = {}) {
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
    const tokens = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();

    const authenticate = (user: { id: string; userId: string | null }) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      tokenByUserId.set(user.id, token);
    };
    authenticate(owner);

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag === FeatureFlags.INVOICES) return input.invoicesEnabled ?? true;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return tokenByUserId.has(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });

    const headersOf = (user: { id: string }) => ({ authorization: `Bearer ${tokenByUserId.get(user.id)}`, "x-organization-id": organization.id });
    const memberWith = async (role: OrganizationRole) => {
      const member = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role });
      authenticate(member);

      return member;
    };

    return { owner, team: { ...organization, owner }, headersOf, memberWith };
  }
});
