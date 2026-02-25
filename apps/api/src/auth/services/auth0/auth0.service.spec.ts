import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner, ManagementClient } from "auth0";

import { Auth0Service } from "./auth0.service";

import { Auth0UserSeeder } from "@test/seeders";

describe(Auth0Service.name, () => {
  describe("sendVerificationEmail", () => {
    it("calls managementClient.jobs.verifyEmail with user ID", async () => {
      const verifyEmail = jest.fn().mockResolvedValue(undefined);
      const { auth0Service } = setup({ jobs: { verifyEmail } });

      await auth0Service.sendVerificationEmail("auth0|abc123");

      expect(verifyEmail).toHaveBeenCalledWith({ user_id: "auth0|abc123" });
    });
  });

  describe("markEmailVerified", () => {
    it("calls managementClient.users.update with email_verified true", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const { auth0Service } = setup({ users: { update } });

      await auth0Service.markEmailVerified("auth0|xyz789");

      expect(update).toHaveBeenCalledWith({ id: "auth0|xyz789" }, { email_verified: true });
    });
  });

  describe("getUserByEmail", () => {
    it("returns user when user is found", async () => {
      const email = faker.internet.email();
      const mockUser: Partial<GetUsers200ResponseOneOfInner> = Auth0UserSeeder.create({
        email: email,
        email_verified: true
      });

      const mockGetByEmail = jest.fn().mockResolvedValue({ data: [mockUser] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns null when no user is found", async () => {
      const email = faker.internet.email();

      const mockGetByEmail = jest.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns first user when multiple users are found", async () => {
      const email = faker.internet.email();
      const mockUsers: Partial<GetUsers200ResponseOneOfInner>[] = [
        Auth0UserSeeder.create({
          email,
          email_verified: true
        }),
        Auth0UserSeeder.create({
          email,
          email_verified: false
        })
      ];

      const mockGetByEmail = jest.fn().mockResolvedValue({ data: mockUsers });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUsers[0]);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("returns null for empty email string", async () => {
      const mockGetByEmail = jest.fn().mockResolvedValue({ data: [] });
      const { auth0Service } = setup({ usersByEmail: { getByEmail: mockGetByEmail } });

      const result = await auth0Service.getUserByEmail("");

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email: "" });
    });
  });

  function setup(
    input: {
      jobs?: { verifyEmail: jest.Mock };
      users?: { update: jest.Mock };
      usersByEmail?: { getByEmail: jest.Mock };
    } = {}
  ) {
    const mockManagementClient = {
      ...input
    } as unknown as ManagementClient;

    const auth0Service = new Auth0Service(mockManagementClient);

    return { auth0Service, mockManagementClient };
  }
});
