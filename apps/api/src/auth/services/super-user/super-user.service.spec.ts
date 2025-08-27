import { SuperUserService } from "./super-user.service";

// Mock environment variables
const originalEnv = process.env;

describe("SuperUserService", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isSuperUser", () => {
    it("should return false and log warning (deprecated method)", () => {
      const service = new SuperUserService();

      expect(service.isSuperUser("auth0|123")).toBe(false);
    });
  });

  describe("hasSuperUserRole", () => {
    it("should return true for metadata with SUPER_USER role", () => {
      const service = new SuperUserService();
      const metadata = { roles: ["SUPER_USER"] };

      expect(service.hasSuperUserRole(metadata)).toBe(true);
    });

    it("should return false for metadata with other roles", () => {
      const service = new SuperUserService();
      const metadata = { roles: ["REGULAR_USER"] };

      expect(service.hasSuperUserRole(metadata)).toBe(false);
    });

    it("should return false for undefined metadata", () => {
      const service = new SuperUserService();

      expect(service.hasSuperUserRole(undefined)).toBe(false);
    });
  });

  describe("validateSuperUserAccess", () => {
    it("should return true when user has super user role in metadata", () => {
      const service = new SuperUserService();
      const metadata = { roles: ["SUPER_USER"] };

      const result = service.validateSuperUserAccess("auth0|123", metadata);

      expect(result).toBe(true);
    });

    it("should return true when user has super user role in roles array", () => {
      const service = new SuperUserService();
      const metadata = { roles: ["SUPER_USER"] };

      const result = service.validateSuperUserAccess("auth0|123", metadata);

      expect(result).toBe(true);
    });

    it("should return false when user has no super user role", () => {
      const service = new SuperUserService();
      const metadata = { roles: ["REGULAR_USER"] };

      const result = service.validateSuperUserAccess("auth0|123", metadata);

      expect(result).toBe(false);
    });

    it("should return false when user has no metadata", () => {
      const service = new SuperUserService();

      const result = service.validateSuperUserAccess("auth0|123");

      expect(result).toBe(false);
    });
  });

  describe("getSuperUserStats", () => {
    it("should return zero statistics (no longer tracking via env vars)", () => {
      const service = new SuperUserService();

      const stats = service.getSuperUserStats();

      expect(stats.totalSuperUsers).toBe(0);
    });
  });
});
