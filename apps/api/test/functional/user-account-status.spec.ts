import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app, initDb } from "@src/rest-app";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Account status on GET /v1/user/me", () => {
  beforeAll(async () => {
    await initDb();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("shows an active account with no reason", async () => {
    const user = await seedUser({ userId: faker.string.uuid() });

    const response = await getCurrentUser(user);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { accountStatus: "active", accountStatusReason: null } });
  });

  it("shows a suspended account the reason written for the user, never the internal note", async () => {
    const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), accountStatus: "suspended" });
    const internalNote = `internal-${faker.string.alphanumeric(16)}`;
    await container.resolve(AccountStatusEventRepository).create({
      userId: user.id,
      userEmail: user.email,
      action: "suspend",
      actorEmail: faker.internet.email(),
      actorName: faker.person.fullName(),
      userReason: "Unpaid invoices",
      internalNote,
      options: { closeDeployments: false }
    });

    const response = await getCurrentUser(user);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ data: { id: user.id, accountStatus: "suspended", accountStatusReason: "Unpaid invoices" } });
    expect(body).not.toContain(internalNote);
    expect(body).not.toContain("internalNote");
  });

  async function getCurrentUser(user: UserOutput) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId : null
    );

    return await app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
  }
});
