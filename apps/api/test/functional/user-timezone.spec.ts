import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("User timezone", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /v1/register-user", () => {
    it("remembers the timezone the browser reports when a new user signs up", async () => {
      const { headers, register } = setup();

      const response = await register({ timezone: "Europe/Paris" });

      expect(response.status).toBe(200);
      expect(await getCurrentUserTimezone(headers)).toBe("Europe/Paris");
    });

    it("follows a detected timezone to the zone the user signs in from next", async () => {
      const { headers, register } = await setupExistingUser({ timezone: "America/New_York", timezonePickedAt: null });

      const response = await register({ timezone: "Asia/Tokyo" });

      expect(response.status).toBe(200);
      expect(await getCurrentUserTimezone(headers)).toBe("Asia/Tokyo");
    });

    it("keeps a timezone the user picked when they sign in from another zone", async () => {
      const { headers, register } = await setupExistingUser({ timezone: "Europe/Paris", timezonePickedAt: faker.date.past() });

      const response = await register({ timezone: "Asia/Tokyo" });

      expect(response.status).toBe(200);
      expect(await getCurrentUserTimezone(headers)).toBe("Europe/Paris");
    });

    it("signs the user in without a timezone when the browser reports one that names no zone", async () => {
      const { headers, register } = setup();

      const response = await register({ timezone: "Mars/Olympus" });

      expect(response.status).toBe(200);
      expect(await getCurrentUserTimezone(headers)).toBeNull();
    });
  });

  describe("PUT /v1/user/updateSettings", () => {
    it("saves the timezone the user picks, which a later sign-in from another zone leaves alone", async () => {
      const { user, headers, register } = await setupExistingUser({ timezone: "America/New_York", timezonePickedAt: null });

      const response = await updateSettings(headers, { username: user.username, timezone: "Europe/Paris" });
      await register({ timezone: "Asia/Tokyo" });

      expect(response.status).toBe(204);
      expect(await getCurrentUserTimezone(headers)).toBe("Europe/Paris");
    });

    it("stores the canonical name of the timezone picked", async () => {
      const { user, headers } = await setupExistingUser({ timezone: null, timezonePickedAt: null });

      const response = await updateSettings(headers, { username: user.username, timezone: "Etc/UTC" });

      expect(response.status).toBe(204);
      expect(await getCurrentUserTimezone(headers)).toBe("UTC");
    });

    it.each(["Mars/Olympus", "+05:00"])("refuses %s, which names no timezone", async timezone => {
      const { user, headers } = await setupExistingUser({ timezone: "America/New_York", timezonePickedAt: null });

      const response = await updateSettings(headers, { username: user.username, timezone });

      expect(response.status).toBe(400);
      expect(await getCurrentUserTimezone(headers)).toBe("America/New_York");
    });
  });

  function updateSettings(headers: Record<string, string>, body: Record<string, unknown>) {
    return app.request("/v1/user/updateSettings", {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function getCurrentUserTimezone(headers: Record<string, string>) {
    const response = await app.request("/v1/user/me", { headers });
    const { data } = (await response.json()) as { data: { timezone: string | null } };
    return data.timezone;
  }

  async function setupExistingUser(input: Pick<UserOutput, "timezone" | "timezonePickedAt">) {
    const user = await userRepository.create({
      userId: faker.string.uuid(),
      username: `user-${faker.string.alphanumeric(12)}`,
      email: faker.internet.email().toLowerCase(),
      emailVerified: true,
      ...input
    });

    return { user, ...setup({ externalUserId: user.userId!, email: user.email! }) };
  }

  function setup(input: { externalUserId?: string; email?: string } = {}) {
    const externalUserId = input.externalUserId ?? faker.string.uuid();
    const email = input.email ?? faker.internet.email().toLowerCase();
    const token = faker.string.alphanumeric(40);
    const headers = { authorization: `Bearer ${token}` };

    vi.spyOn(container.resolve(Auth0Service), "getUser").mockImplementation(async userId =>
      userId === externalUserId ? mock<GetUsers200ResponseOneOfInner>({ user_id: userId, email, email_verified: true }) : null
    );
    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? externalUserId : null));
    vi.spyOn(container.resolve(NotificationService), "createDefaultChannel").mockResolvedValue(undefined);

    const register = (body: { timezone: string }) =>
      app.request("/v1/register-user", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ wantedUsername: `user-${faker.string.alphanumeric(12)}`, subscribedToNewsletter: false, ...body })
      });

    return { headers, register };
  }
});
