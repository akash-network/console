import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { app, initDb } from "@src/rest-app";
import type { AccountStatusEventInput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserInput, UserOutput } from "@src/user/repositories/user/user.repository";

import { seedPersonalOrganizationIdOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Account status", () => {
  beforeAll(async () => {
    await initDb();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/user/me", () => {
    it("shows an active account with no reason", async () => {
      const user = await seedUser({ userId: faker.string.uuid() });

      const response = await getCurrentUser(user);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { accountStatus: "active", accountStatusReason: null } });
    });

    it("shows a suspended account the reason written for the user, never the internal note", async () => {
      const internalNote = `internal-${faker.string.alphanumeric(16)}`;
      const user = await seedUserWithStatus(
        { accountStatus: "suspended" },
        { action: "suspend", userReason: "Unpaid invoices", internalNote, options: { closeDeployments: false } }
      );

      const response = await getCurrentUser(user);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toMatchObject({ data: { id: user.id, accountStatus: "suspended", accountStatusReason: "Unpaid invoices" } });
      expect(body).not.toContain(internalNote);
      expect(body).not.toContain("internalNote");
    });
  });

  describe("a terminated account", () => {
    it("has its API key cut off on every request, GET included", async () => {
      const user = await seedTerminatedUser();
      const apiKey = await seedApiKey(user.id);

      const response = await app.request("/v1/user/me", { headers: { "x-api-key": apiKey } });

      const body = await response.text();
      expect(response.status).toBe(403);
      expect(JSON.parse(body)).toMatchObject({ code: "account_terminated", data: { reason: "Fraud" } });
      expect(body).not.toContain("Stolen cards");
    });

    it("keeps a read-only session", async () => {
      const user = await seedTerminatedUser();

      const me = await getCurrentUser(user);
      const write = await requestAs(user, "/v1/user/skipOnboarding", { method: "POST" });

      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({ data: { accountStatus: "terminated", accountStatusReason: "Fraud" } });
      expect(write.status).toBe(403);
      expect(await write.json()).toMatchObject({ code: "account_terminated", data: { reason: "Fraud" } });
    });

    it("can sign back in", async () => {
      const user = await seedTerminatedUser({ email: faker.internet.email(), emailVerified: true });
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
  });

  async function seedTerminatedUser(overrides: UserInput = {}) {
    return await seedUserWithStatus(
      { ...overrides, accountStatus: "terminated" },
      {
        action: "terminate",
        userReason: "Fraud",
        internalNote: "Stolen cards",
        options: { forfeitCredits: false, emailVerified: overrides.emailVerified ?? false }
      }
    );
  }

  async function seedUserWithStatus(overrides: UserInput, event: Pick<AccountStatusEventInput, "action" | "userReason" | "internalNote" | "options">) {
    const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), ...overrides });
    await container.resolve(AccountStatusEventRepository).create({
      userId: user.id,
      userEmail: user.email,
      actorEmail: faker.internet.email(),
      actorName: faker.person.fullName(),
      ...event
    });

    return user;
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
      organizationId: await seedPersonalOrganizationIdOf(userId),
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
