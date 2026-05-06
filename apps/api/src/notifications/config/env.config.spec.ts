import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  let originalInterface: string | undefined;

  beforeEach(() => {
    originalInterface = process.env.INTERFACE;
  });

  afterEach(() => {
    if (originalInterface === undefined) {
      delete process.env.INTERFACE;
    } else {
      process.env.INTERFACE = originalInterface;
    }
  });

  describe("outside swagger-gen mode", () => {
    beforeEach(() => {
      delete process.env.INTERFACE;
    });

    it("requires NOTIFICATIONS_API_BASE_URL", () => {
      const result = envSchema.safeParse({});

      expect(result.success).toBe(false);
      const issue = !result.success ? result.error.issues[0] : undefined;
      expect(issue?.path).toEqual(["NOTIFICATIONS_API_BASE_URL"]);
    });

    it("accepts a valid base URL", () => {
      const result = envSchema.safeParse({ NOTIFICATIONS_API_BASE_URL: "https://api.example.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("in swagger-gen mode", () => {
    beforeEach(() => {
      process.env.INTERFACE = "swagger-gen";
    });

    it("requires NOTIFICATIONS_SWAGGER_PATH", () => {
      const result = envSchema.safeParse({});

      expect(result.success).toBe(false);
      const issue = !result.success ? result.error.issues[0] : undefined;
      expect(issue?.path).toEqual(["NOTIFICATIONS_SWAGGER_PATH"]);
    });

    it("does not require NOTIFICATIONS_API_BASE_URL", () => {
      const result = envSchema.safeParse({ NOTIFICATIONS_SWAGGER_PATH: "../notifications/swagger/swagger.json" });
      expect(result.success).toBe(true);
    });
  });
});
