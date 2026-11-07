import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app, initDb } from "@src/rest-app";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { CloseAccountDeployments, closeAccountDeploymentsKeyFor } from "@src/user/services/close-account-deployments/close-account-deployments.job";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

describe("Internal account status", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const actor = { staffId: faker.string.uuid(), email: faker.internet.email(), name: faker.person.fullName() };

  beforeAll(async () => {
    await initDb();
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("authentication", () => {
    it.each([undefined, "wrong-token"])("rejects every account status route for a caller with the token %j", async token => {
      const userId = faker.string.uuid();

      const responses = await Promise.all([
        post(`/internal/v1/users/${userId}/suspend`, { actor, userReason: "Abuse", closeDeployments: false }, { token }),
        post(`/internal/v1/users/${userId}/reinstate`, { actor }, { token }),
        app.request(`/internal/v1/users/${userId}/account-status-events`, { headers: token ? { "x-console-internal-token": token } : {} })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 401, 401]);
    });

    it("stays out of the unauthenticated internal openapi document", async () => {
      const response = await app.request("/internal/doc");

      const document = JSON.stringify(await response.json());
      expect(document).not.toContain("suspendUserAccount");
      expect(document).not.toContain("reinstateUserAccount");
      expect(document).not.toContain("listUserAccountStatusEvents");
    });
  });

  describe("POST /internal/v1/users/{userId}/suspend", () => {
    it("suspends the user and shows them the user reason on /v1/user/me, never the internal note", async () => {
      const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
      const internalNote = `internal-${faker.string.alphanumeric(16)}`;

      const response = await post(`/internal/v1/users/${user.id}/suspend`, { actor, userReason: "Unpaid invoices", internalNote, closeDeployments: false });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: expect.any(String),
          userId: user.id,
          userEmail: user.email,
          action: "suspend",
          actorStaffId: actor.staffId,
          actorEmail: actor.email,
          actorName: actor.name,
          userReason: "Unpaid invoices",
          internalNote,
          options: { closeDeployments: false },
          notificationSentAt: null,
          createdAt: expect.any(String)
        }
      });

      const me = await getCurrentUser(user);
      const body = await me.text();
      expect(me.status).toBe(200);
      expect(JSON.parse(body)).toMatchObject({ data: { id: user.id, accountStatus: "suspended", accountStatusReason: "Unpaid invoices" } });
      expect(body).not.toContain(internalNote);
      expect(body).not.toContain("internalNote");
    });

    it("queues the close of the user's deployments when asked to", async () => {
      const user = await seedUser();

      const response = await post(`/internal/v1/users/${user.id}/suspend`, { actor, userReason: "Abuse", closeDeployments: true });

      expect(response.status).toBe(200);
      expect(await findJobRows(CloseAccountDeployments[JOB_NAME], { singletonKey: closeAccountDeploymentsKeyFor(user.id) })).toEqual([
        expect.objectContaining({ data: { userId: user.id, version: 1 } })
      ]);
    });

    it("answers 409 account_status_conflict for an account that is already suspended", async () => {
      const user = await seedUser({ accountStatus: "suspended" });

      const response = await post(`/internal/v1/users/${user.id}/suspend`, { actor, userReason: "Again", closeDeployments: false });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "account_status_conflict", data: { accountStatus: "suspended" } });
    });

    it("answers 404 for an unknown user", async () => {
      const response = await post(`/internal/v1/users/${faker.string.uuid()}/suspend`, { actor, userReason: "Abuse", closeDeployments: false });

      expect(response.status).toBe(404);
    });

    it("rejects a suspension without a user reason and leaves the account active", async () => {
      const user = await seedUser();

      const response = await post(`/internal/v1/users/${user.id}/suspend`, { actor, userReason: "  ", closeDeployments: false });

      expect(response.status).toBe(400);
      expect(await findAccountStatus(user.id)).toBe("active");
    });
  });

  describe("POST /internal/v1/users/{userId}/reinstate", () => {
    it("reactivates a suspended account and records the note as internal", async () => {
      const user = await seedUser({ userId: faker.string.uuid(), accountStatus: "suspended" });

      const response = await post(`/internal/v1/users/${user.id}/reinstate`, { actor, note: "Paid in full" });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { action: "reinstate", userReason: null, internalNote: "Paid in full", options: {} } });
      expect(await findAccountStatus(user.id)).toBe("active");
    });

    it("answers 409 account_status_conflict for an active account", async () => {
      const user = await seedUser();

      const response = await post(`/internal/v1/users/${user.id}/reinstate`, { actor });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "account_status_conflict" });
    });
  });

  describe("GET /internal/v1/users/{userId}/account-status-events", () => {
    it("lists the user's events newest first, internal notes included", async () => {
      const user = await seedUser({ email: faker.internet.email() });
      const repository = container.resolve(AccountStatusEventRepository);
      const record = (action: "suspend" | "reinstate", minutesAgo: number, internalNote: string) =>
        repository.create({
          userId: user.id,
          userEmail: user.email,
          action,
          actorEmail: actor.email,
          actorName: actor.name,
          internalNote,
          createdAt: subMinutes(new Date(), minutesAgo)
        });
      const suspension = await record("suspend", 10, "first note");
      const reinstatement = await record("reinstate", 5, "second note");

      const response = await app.request(`/internal/v1/users/${user.id}/account-status-events`, { headers: { "x-console-internal-token": internalToken! } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          expect.objectContaining({ id: reinstatement.id, action: "reinstate", internalNote: "second note" }),
          expect.objectContaining({ id: suspension.id, action: "suspend", internalNote: "first note" })
        ]
      });
    });
  });

  describe("GET /v1/user/me", () => {
    it("shows an active account with no reason", async () => {
      const user = await seedUser({ userId: faker.string.uuid() });

      const response = await getCurrentUser(user);

      expect(await response.json()).toMatchObject({ data: { accountStatus: "active", accountStatusReason: null } });
    });
  });

  async function post(path: string, body: Record<string, unknown>, { token }: { token?: string } = { token: internalToken }) {
    return await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-console-internal-token": token } : {}) },
      body: JSON.stringify({ data: body })
    });
  }

  async function getCurrentUser(user: UserOutput) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId : null
    );

    return await app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
  }

  async function findAccountStatus(userId: string) {
    const users = resolveTable("Users");
    const [user] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select({ accountStatus: users.accountStatus }).from(users).where(eq(users.id, userId));
    return user?.accountStatus;
  }
});
