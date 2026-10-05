import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import type { CreateLogger } from "@src/core";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { PurgeDeletedAccount, PurgeDeletedAccountHandler } from "./purge-deleted-account.handler";

describe(PurgeDeletedAccountHandler.name, () => {
  it("removes the user's notification data, Auth0 user and Stripe customer", async () => {
    const { handler, payload, notificationService, auth0Service, customerService, logger } = setup();

    await handler.handle(payload);

    expect(notificationService.purgeUserData).toHaveBeenCalledWith(payload.userId);
    expect(auth0Service.deleteUser).toHaveBeenCalledWith(payload.auth0UserId);
    expect(customerService.deleteCustomer).toHaveBeenCalledWith(payload.stripeCustomerId);
    expect(logger.info).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_CLEANUP_COMPLETED", userId: payload.userId });
  });

  it("skips Auth0 and Stripe for a user who had neither", async () => {
    const { handler, payload, notificationService, auth0Service, customerService } = setup({ auth0UserId: null, stripeCustomerId: null });

    await handler.handle(payload);

    expect(notificationService.purgeUserData).toHaveBeenCalledWith(payload.userId);
    expect(auth0Service.deleteUser).not.toHaveBeenCalled();
    expect(customerService.deleteCustomer).not.toHaveBeenCalled();
  });

  it("still runs the other steps when one fails, then fails the job so the queue retries", async () => {
    const outage = new Error("Auth0 unavailable");
    const { handler, payload, auth0Service, customerService, logger } = setup();
    auth0Service.deleteUser.mockRejectedValue(outage);

    await expect(handler.handle(payload)).rejects.toThrow("Account cleanup failed at: auth0");

    expect(customerService.deleteCustomer).toHaveBeenCalledWith(payload.stripeCustomerId);
    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "ACCOUNT_DELETION_CLEANUP_COMPLETED" }));
  });

  it("reports every failed step with its error", async () => {
    const notificationsDown = new TypeError("fetch failed");
    const stripeDown = new Error("Stripe unavailable");
    const { handler, payload, notificationService, customerService, logger, analyticsService } = setup();
    notificationService.purgeUserData.mockRejectedValue(notificationsDown);
    customerService.deleteCustomer.mockRejectedValue(stripeDown);

    await expect(handler.handle(payload)).rejects.toThrow("Account cleanup failed at: notifications, stripe");

    expect(logger.error).toHaveBeenCalledWith({
      event: "ACCOUNT_DELETION_CLEANUP_FAILED",
      userId: payload.userId,
      step: "notifications",
      error: notificationsDown
    });
    expect(logger.error).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_CLEANUP_FAILED", userId: payload.userId, step: "stripe", error: stripeDown });
    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "account_deletion_failed", { step: "notifications", error_type: "TypeError" });
    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "account_deletion_failed", { step: "stripe", error_type: "Error" });
  });

  it("reports the type of a failure that is not an Error", async () => {
    const { handler, payload, auth0Service, analyticsService } = setup();
    auth0Service.deleteUser.mockRejectedValue("rate limited");

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "account_deletion_failed", { step: "auth0", error_type: "string" });
  });

  it("accepts the job the deletion enqueues", () => {
    const { handler } = setup();

    expect(handler.accepts).toBe(PurgeDeletedAccount);
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: PurgeDeletedAccountHandler.name });
  });

  function setup(input: { auth0UserId?: string | null; stripeCustomerId?: string | null } = {}) {
    const payload = {
      userId: faker.string.uuid(),
      auth0UserId: input.auth0UserId === undefined ? `auth0|${faker.string.alphanumeric(24)}` : input.auth0UserId,
      stripeCustomerId: input.stripeCustomerId === undefined ? `cus_${faker.string.alphanumeric(14)}` : input.stripeCustomerId,
      version: 1 as const
    };

    const notificationService = mock<NotificationService>();
    const auth0Service = mock<Auth0Service>();
    const customerService = mock<CustomerService>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new PurgeDeletedAccountHandler(notificationService, auth0Service, customerService, analyticsService, createLogger);

    return { handler, payload, notificationService, auth0Service, customerService, analyticsService, logger, createLogger };
  }
});
