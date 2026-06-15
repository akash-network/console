import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner, ManagementClient } from "auth0";
import type { Mock } from "vitest";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Auth0Service } from "./auth0.service";

import { createAuth0User } from "@test/seeders";

describe(Auth0Service.name, () => {
  describe("createUser", () => {
    it("calls managementClient.users.create with verify_email false", async () => {
      const create = vi.fn().mockResolvedValue({ data: {} });
      const { auth0Service } = setup({ users: { create } });

      await auth0Service.createUser({
        email: "user@example.com",
        password: "StrongPassword123!",
        connection: "Username-Password-Authentication"
      });

      expect(create).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "StrongPassword123!",
        connection: "Username-Password-Authentication",
        verify_email: false
      });
    });
  });

  describe("sendVerificationEmail", () => {
    it("calls managementClient.jobs.verifyEmail with user ID", async () => {
      const verifyEmail = vi.fn().mockResolvedValue(undefined);
      const { auth0Service } = setup({ jobs: { verifyEmail } });

      await auth0Service.sendVerificationEmail("auth0|abc123");

      expect(verifyEmail).toHaveBeenCalledWith({ user_id: "auth0|abc123" });
    });
  });

  describe("markEmailVerified", () => {
    it("calls managementClient.users.update with email_verified true", async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const { auth0Service } = setup({ users: { update } });

      await auth0Service.markEmailVerified("auth0|xyz789");

      expect(update).toHaveBeenCalledWith({ id: "auth0|xyz789" }, { email_verified: true });
    });
  });

  describe("getUserByEmail", () => {
    it("returns user when user is found", async () => {
      const email = faker.internet.email();
      const mockUser: Partial<GetUsers200ResponseOneOfInner> = createAuth0User({
        email: email,
        email_verified: true
      });

      const mockGetByEmail = vi.fn().mockResolvedValue({ data: [mockUser] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns null when no user is found", async () => {
      const email = faker.internet.email();

      const mockGetByEmail = vi.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns first user when multiple users are found", async () => {
      const email = faker.internet.email();
      const mockUsers: Partial<GetUsers200ResponseOneOfInner>[] = [
        createAuth0User({
          email,
          email_verified: true
        }),
        createAuth0User({
          email,
          email_verified: false
        })
      ];

      const mockGetByEmail = vi.fn().mockResolvedValue({ data: mockUsers });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUsers[0]);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns null for empty email string", async () => {
      const mockGetByEmail = vi.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail("");

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email: "" });
    });
  });

  describe("getUsersByEmail", () => {
    it("returns all users found for the email", async () => {
      const email = faker.internet.email();
      const mockUsers: Partial<GetUsers200ResponseOneOfInner>[] = [
        createAuth0User({ email, email_verified: true }),
        createAuth0User({ email, email_verified: false })
      ];

      const mockGetByEmail = vi.fn().mockResolvedValue({ data: mockUsers });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUsersByEmail(email);

      expect(result).toEqual(mockUsers);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns an empty array when no users are found", async () => {
      const email = faker.internet.email();
      const mockGetByEmail = vi.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUsersByEmail(email);

      expect(result).toEqual([]);
    });
  });

  describe("linkUsers", () => {
    it("links the secondary identity into the primary user", async () => {
      const link = vi.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ users: { link } });

      await auth0Service.linkUsers("auth0|primary", { provider: "google-oauth2", userId: "google-oauth2|secondary" });

      expect(link).toHaveBeenCalledWith({ id: "auth0|primary" }, { provider: "google-oauth2", user_id: "google-oauth2|secondary", connection_id: undefined });
    });

    it("passes connection_id when provided", async () => {
      const link = vi.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ users: { link } });

      await auth0Service.linkUsers("auth0|primary", { provider: "auth0", userId: "auth0|secondary", connectionId: "con_123" });

      expect(link).toHaveBeenCalledWith({ id: "auth0|primary" }, { provider: "auth0", user_id: "auth0|secondary", connection_id: "con_123" });
    });
  });

  function setup(
    input: {
      jobs?: { verifyEmail: Mock };
      users?: { update?: Mock; create?: Mock; link?: Mock };
      usersByEmail?: { getByEmail: Mock };
    } = {}
  ) {
    const mockManagementClient = mock<ManagementClient>(input);

    const auth0Service = new Auth0Service(mockManagementClient);

    return { auth0Service, mockManagementClient };
  }
});
