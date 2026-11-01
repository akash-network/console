import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { VerifiedEmailService } from "./verified-email.service";

import { createAuth0User } from "@test/seeders";

describe(VerifiedEmailService.name, () => {
  describe("getEmail", () => {
    it.each([true, false])("answers the address Auth0 holds for the user and whether it is verified (%s)", async emailVerified => {
      const userId = `auth0|${faker.string.alphanumeric(24)}`;
      const email = faker.internet.email();
      const { service, auth0Service } = setup({ auth0User: { email, email_verified: emailVerified } });

      await expect(service.getEmail(userId)).resolves.toEqual({ email, emailVerified });
      expect(auth0Service.getUser).toHaveBeenCalledWith(userId);
    });

    it("treats an address Auth0 reports no verification for as unverified", async () => {
      const email = faker.internet.email();
      const { service } = setup({ auth0User: { email, email_verified: undefined } });

      await expect(service.getEmail(`auth0|${faker.string.alphanumeric(24)}`)).resolves.toEqual({ email, emailVerified: false });
    });

    it.each([
      { case: "no address", auth0User: { email: undefined, email_verified: true } },
      { case: "no Auth0 user", auth0User: null }
    ])("answers null for $case", async ({ auth0User }) => {
      const { service } = setup({ auth0User });

      await expect(service.getEmail(`auth0|${faker.string.alphanumeric(24)}`)).resolves.toBeNull();
    });
  });

  describe("getVerifiedEmail", () => {
    it("answers the address Auth0 verified for the user, in lowercase without surrounding spaces", async () => {
      const userId = `auth0|${faker.string.alphanumeric(24)}`;
      const { service, auth0Service } = setup({ auth0User: { email: " Jane@Example.COM ", email_verified: true } });

      await expect(service.getVerifiedEmail(userId)).resolves.toBe("jane@example.com");
      expect(auth0Service.getUser).toHaveBeenCalledWith(userId);
    });

    it.each([
      { case: "an address Auth0 has not verified", auth0User: { email: "jane@example.com", email_verified: false } },
      { case: "no address", auth0User: { email: undefined, email_verified: true } },
      { case: "no Auth0 user", auth0User: null }
    ])("answers null for $case", async ({ auth0User }) => {
      const { service } = setup({ auth0User });

      await expect(service.getVerifiedEmail(`auth0|${faker.string.alphanumeric(24)}`)).resolves.toBeNull();
    });
  });

  describe("getRecentVerifiedEmail", () => {
    it("asks Auth0 once per user while the answer is recent", async () => {
      const [userId, otherUserId] = [`auth0|${faker.string.alphanumeric(24)}`, `auth0|${faker.string.alphanumeric(24)}`];
      const { service, auth0Service } = setup({ auth0User: { email: "jane@example.com", email_verified: true } });

      await expect(service.getRecentVerifiedEmail(userId)).resolves.toBe("jane@example.com");
      await expect(service.getRecentVerifiedEmail(userId)).resolves.toBe("jane@example.com");
      await service.getRecentVerifiedEmail(otherUserId);

      expect(auth0Service.getUser.mock.calls).toEqual([[userId], [otherUserId]]);
    });

    it("remembers that a user has no verified address", async () => {
      const userId = `auth0|${faker.string.alphanumeric(24)}`;
      const { service, auth0Service } = setup({ auth0User: { email: "jane@example.com", email_verified: false } });

      await expect(service.getRecentVerifiedEmail(userId)).resolves.toBeNull();
      await expect(service.getRecentVerifiedEmail(userId)).resolves.toBeNull();

      expect(auth0Service.getUser).toHaveBeenCalledTimes(1);
    });
  });

  function setup(input: { auth0User: { email?: string; email_verified?: boolean } | null }) {
    const auth0Service = mock<Auth0Service>({
      getUser: vi.fn().mockResolvedValue(input.auth0User && createAuth0User(input.auth0User))
    });
    const service = new VerifiedEmailService(auth0Service);

    return { service, auth0Service };
  }
});
