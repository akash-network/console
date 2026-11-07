import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app, initDb } from "@src/rest-app";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { ApplyAccountTermination, applyAccountTerminationKeyFor } from "@src/user/services/apply-account-termination/apply-account-termination.job";
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
        post(`/internal/v1/users/${userId}/terminate`, { actor, userReason: "Fraud", forfeitCredits: false }, { token }),
        app.request(`/internal/v1/users/${userId}/account-status-events`, { headers: token ? { "x-console-internal-token": token } : {} })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
    });

    it("stays out of the unauthenticated internal openapi document", async () => {
      const response = await app.request("/internal/doc");

      const document = JSON.stringify(await response.json());
      expect(document).not.toContain("suspendUserAccount");
      expect(document).not.toContain("reinstateUserAccount");
      expect(document).not.toContain("terminateUserAccount");
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

  describe("POST /internal/v1/users/{userId}/terminate", () => {
    it("terminates the account and queues its effects with the admin's credit choice", async () => {
      const user = await seedUser({ userId: faker.string.uuid(), accountStatus: "suspended" });

      const response = await post(`/internal/v1/users/${user.id}/terminate`, {
        actor,
        userReason: "Fraud",
        internalNote: "Stolen cards",
        forfeitCredits: true
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        data: { action: "terminate", userReason: "Fraud", internalNote: "Stolen cards", options: { forfeitCredits: true } }
      });
      expect(await findAccountStatus(user.id)).toBe("terminated");
      expect(await findJobRows(ApplyAccountTermination[JOB_NAME], { singletonKey: applyAccountTerminationKeyFor(user.id) })).toEqual([
        expect.objectContaining({ data: { userId: user.id, forfeitCredits: true, version: 1 } })
      ]);
    });

    it("cuts off the user's API key on every request, GET included", async () => {
      const user = await seedUser({ userId: faker.string.uuid() });
      const apiKey = await seedApiKey(user.id);
      await post(`/internal/v1/users/${user.id}/terminate`, { actor, userReason: "Fraud", internalNote: "Stolen cards", forfeitCredits: false });

      const response = await app.request("/v1/user/me", { headers: { "x-api-key": apiKey } });

      const body = await response.text();
      expect(response.status).toBe(403);
      expect(JSON.parse(body)).toMatchObject({ code: "account_terminated", data: { reason: "Fraud" } });
      expect(body).not.toContain("Stolen cards");
    });

    it("leaves the user's session read-only", async () => {
      const user = await seedUser({ userId: faker.string.uuid() });
      await post(`/internal/v1/users/${user.id}/terminate`, { actor, userReason: "Fraud", forfeitCredits: false });

      const me = await getCurrentUser(user);
      const write = await requestAs(user, "/v1/user/skipOnboarding", { method: "POST" });

      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({ data: { accountStatus: "terminated", accountStatusReason: "Fraud" } });
      expect(write.status).toBe(403);
      expect(await write.json()).toMatchObject({ code: "account_terminated", data: { reason: "Fraud" } });
    });

    it("lets the user sign back in to the terminated account", async () => {
      const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), emailVerified: true });
      await post(`/internal/v1/users/${user.id}/terminate`, { actor, userReason: "Fraud", forfeitCredits: false });
      vi.spyOn(container.resolve(Auth0Service), "getUser").mockResolvedValue(
        mock<GetUsers200ResponseOneOfInner>({ user_id: user.userId!, email: user.email!, email_verified: true })
      );

      const response = await requestAs(user, "/v1/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wantedUsername: faker.internet.userName() })
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: user.id }, isNewUser: false });
      expect(await findAccountStatus(user.id)).toBe("terminated");
    });

    it("answers 409 account_status_conflict for an account that is already terminated", async () => {
      const user = await seedUser({ accountStatus: "terminated" });

      const response = await post(`/internal/v1/users/${user.id}/terminate`, { actor, userReason: "Again", forfeitCredits: false });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "account_status_conflict", data: { accountStatus: "terminated" } });
    });

    it("rejects a termination without the credit choice and leaves the account active", async () => {
      const user = await seedUser();

      const response = await post(`/internal/v1/users/${user.id}/terminate`, { actor, userReason: "Fraud" });

      expect(response.status).toBe(400);
      expect(await findAccountStatus(user.id)).toBe("active");
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
    return await requestAs(user, "/v1/user/me");
  }

  async function requestAs(user: UserOutput, path: string, init: RequestInit = {}) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId : null
    );

    return await app.request(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
  }

  async function seedApiKey(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      userId,
      hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  async function findAccountStatus(userId: string) {
    const users = resolveTable("Users");
    const [user] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select({ accountStatus: users.accountStatus }).from(users).where(eq(users.id, userId));
    return user?.accountStatus;
  }
});
