import type { LoggerService } from "@akashnetwork/logging";
import type { Session } from "@auth0/nextjs-auth0";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { FeatureFlagService } from "@src/services/feature-flag/feature-flag.service";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled, redirectIfAccessTokenExpired } from "./pageGuards";

describe("pageGuards", () => {
  describe("isAuthenticated", () => {
    it("returns true when user is logged in", async () => {
      const context = setup({
        session: {
          user: {
            id: faker.string.uuid()
          }
        }
      });

      const result = await isAuthenticated(context);

      expect(result).toBe(true);
    });

    it("returns false when user is not logged in", async () => {
      const context = setup({
        session: undefined
      });

      const result = await isAuthenticated(context);

      expect(result).toBe(false);
    });
  });

  describe("isFeatureEnabled", () => {
    it("returns true when feature flag is enabled", async () => {
      const context = setup({
        enabledFeatures: ["test"]
      });

      expect(await isFeatureEnabled("test", context)).toBe(true);
      expect(await isFeatureEnabled("test2", context)).toBe(false);
      expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("test", context, expect.anything());
    });

    it("passes the user id to the feature flag service", async () => {
      const userId = faker.string.uuid();
      const context = setup({
        enabledFeatures: ["test"],
        session: {
          user: {
            id: userId
          }
        }
      });

      expect(await isFeatureEnabled("test", context)).toBe(true);
      expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("test", context, { userId });
    });
  });

  describe("redirectIfAccessTokenExpired", () => {
    it("returns null when access token is not expired", async () => {
      const context = setup({
        session: {
          accessTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
        }
      });

      const result = await redirectIfAccessTokenExpired(context);

      expect(result).toBeNull();
    });

    it("returns redirect when access token is expired", async () => {
      const context = setup({
        session: {
          accessTokenExpiresAt: (Date.now() - 1000 * 60 * 60 * 24 * 30) / 1000
        }
      });

      const result = await redirectIfAccessTokenExpired(context);

      expect(result).toEqual({
        redirect: {
          destination: expect.stringMatching(/^\/api\/auth\/login/),
          permanent: false
        }
      });
    });
  });
});

function setup(input?: { enabledFeatures?: string[]; session?: Partial<Session> }) {
  return mock<AppTypedContext>({
    session: input?.session,
    services: {
      featureFlagService: mock<FeatureFlagService>({
        isEnabledForCtx: jest.fn(async featureName => !!input?.enabledFeatures?.includes(featureName))
      }),
      logger: mock<LoggerService>()
    }
  });
}
