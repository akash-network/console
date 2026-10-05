import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { CustomerService } from "./customer.service";

describe(CustomerService.name, () => {
  describe("getStripeCustomerId", () => {
    it("returns the existing customer id without creating one", async () => {
      const { service, stripe } = setup();
      const create = vi.spyOn(stripe.customers, "create");
      const user = mock<UserOutput>({ id: "user_1", stripeCustomerId: "cus_existing" });

      const result = await service.getStripeCustomerId(user);

      expect(result).toBe("cus_existing");
      expect(create).not.toHaveBeenCalled();
    });

    it("creates and persists a Stripe customer when the user has none", async () => {
      const { service, stripe, userRepository } = setup();
      const user = mock<UserOutput>({ id: "user_1", stripeCustomerId: null, email: "alice@example.com", username: "alice" });
      vi.spyOn(stripe.customers, "create").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>({ id: "cus_new" }));
      userRepository.updateBy.mockResolvedValue(mock<UserOutput>({ stripeCustomerId: "cus_new" }) as never);

      const result = await service.getStripeCustomerId(user);

      expect(stripe.customers.create).toHaveBeenCalledWith(
        { email: "alice@example.com", name: "alice", metadata: { userId: "user_1" } },
        { idempotencyKey: "create-customer:user_1" }
      );
      expect(userRepository.updateBy).toHaveBeenCalledWith({ id: "user_1", stripeCustomerId: null }, { stripeCustomerId: "cus_new" }, { returning: true });
      expect(result).toBe("cus_new");
    });

    it("returns the concurrently-persisted id when the update is a no-op", async () => {
      const { service, stripe, userRepository } = setup();
      const user = mock<UserOutput>({ id: "user_1", stripeCustomerId: null });
      vi.spyOn(stripe.customers, "create").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>({ id: "cus_new" }));
      userRepository.updateBy.mockResolvedValue(undefined);
      userRepository.findOneBy.mockResolvedValue(mock<UserOutput>({ id: "user_1", stripeCustomerId: "cus_concurrent" }));

      const result = await service.getStripeCustomerId(user);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: "user_1" });
      expect(result).toBe("cus_concurrent");
    });

    it("throws when the concurrently-created customer id cannot be reloaded", async () => {
      const { service, stripe, userRepository } = setup();
      const user = mock<UserOutput>({ id: "user_1", stripeCustomerId: null });
      vi.spyOn(stripe.customers, "create").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>({ id: "cus_new" }));
      userRepository.updateBy.mockResolvedValue(undefined);
      userRepository.findOneBy.mockResolvedValue(mock<UserOutput>({ id: "user_1", stripeCustomerId: null }));

      await expect(service.getStripeCustomerId(user)).rejects.toMatchObject({ status: 500 });
    });
  });

  describe("deleteCustomer", () => {
    it("deletes the Stripe customer", async () => {
      const { service, stripe } = setup();
      const del = vi.spyOn(stripe.customers, "del").mockResolvedValue(mock<Stripe.Response<Stripe.DeletedCustomer>>({ id: "cus_1", deleted: true }));

      await service.deleteCustomer("cus_1");

      expect(del).toHaveBeenCalledWith("cus_1");
    });

    it("treats a customer Stripe no longer has as deleted", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.customers, "del").mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "resource_missing", message: "No such customer: 'cus_1'" })
      );

      await expect(service.deleteCustomer("cus_1")).resolves.toBeUndefined();
    });

    it("rethrows any other failure", async () => {
      const { service, stripe } = setup();
      const outage = new Stripe.errors.StripeAPIError({ type: "api_error", message: "Stripe is down" });
      vi.spyOn(stripe.customers, "del").mockRejectedValue(outage);

      await expect(service.deleteCustomer("cus_1")).rejects.toBe(outage);
    });

    it("rethrows an invalid request that is not a missing customer", async () => {
      const { service, stripe } = setup();
      const invalid = new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "parameter_invalid_empty", message: "Invalid id" });
      vi.spyOn(stripe.customers, "del").mockRejectedValue(invalid);

      await expect(service.deleteCustomer("cus_1")).rejects.toBe(invalid);
    });
  });

  describe("updateCustomerOrganization", () => {
    it("sets the customer business name", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>({ id: "cus_1" }));
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>({ id: "cus_1" }));

      await service.updateCustomerOrganization("cus_1", "Acme Inc");

      expect(update).toHaveBeenCalledWith("cus_1", { business_name: "Acme Inc" });
    });

    it("rejects when the customer is deleted", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue(mock<Stripe.Response<Stripe.DeletedCustomer>>({ id: "cus_1", deleted: true }));

      await expect(service.updateCustomerOrganization("cus_1", "Acme Inc")).rejects.toMatchObject({ status: 404 });
    });
  });

  function setup() {
    const userRepository = mock<UserRepository>();
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    const service = new CustomerService(stripe, userRepository);
    return { service, stripe, userRepository };
  }
});
