import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner, ManagementClient } from "auth0";
import { mock } from "vitest-mock-extended";

import type { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { Auth0Service } from "./auth0.service";

import { Auth0UserSeeder } from "@test/seeders";

describe(Auth0Service.name, () => {
  describe("getUserByEmail", () => {
    it("should return user when user is found", async () => {
      const email = faker.internet.email();
      const mockUser: Partial<GetUsers200ResponseOneOfInner> = Auth0UserSeeder.create({
        email: email,
        email_verified: true
      });

      const { auth0Service, mockGetByEmail } = setup({
        mockUsers: [mockUser as GetUsers200ResponseOneOfInner]
      });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("should return null when no user is found", async () => {
      const email = faker.internet.email();

      const { auth0Service, mockGetByEmail } = setup({
        mockUsers: []
      });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("should return first user when multiple users are found", async () => {
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

      const { auth0Service, mockGetByEmail } = setup({
        mockUsers: mockUsers as GetUsers200ResponseOneOfInner[]
      });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toEqual(mockUsers[0]);
      expect(mockGetByEmail).toHaveBeenCalledWith({ email });
    });

    it("should handle empty email string", async () => {
      const email = "";

      const { auth0Service, mockGetByEmail } = setup({
        mockUsers: []
      });

      const result = await auth0Service.getUserByEmail(email);

      expect(result).toBeNull();
      expect(mockGetByEmail).toHaveBeenCalledWith({ email: "" });
    });

    function setup(input: { mockUsers?: GetUsers200ResponseOneOfInner[]; mockError?: Error }) {
      const mockAuthConfig = mock<AuthConfigService>();
      mockAuthConfig.get.mockImplementation((key: string) => {
        const config = {
          AUTH0_M2M_DOMAIN: "test-domain.auth0.com",
          AUTH0_M2M_CLIENT_ID: "test-client-id",
          AUTH0_M2M_SECRET: "test-client-secret"
        };
        return config[key as keyof typeof config];
      });

      const mockGetByEmail = jest.fn();
      const mockManagementClient = {
        usersByEmail: {
          getByEmail: mockGetByEmail
        }
      } as unknown as ManagementClient;

      if (input.mockError) {
        mockGetByEmail.mockRejectedValue(input.mockError);
      } else {
        mockGetByEmail.mockResolvedValue({
          data: input.mockUsers || []
        });
      }

      const auth0Service = new Auth0Service(mockManagementClient);

      return {
        auth0Service,
        mockGetByEmail,
        mockManagementClient
      };
    }
  });
});
