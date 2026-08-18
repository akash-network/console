import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Session } from "@src/lib/auth0";
import { UrlService } from "@src/utils/urlUtils";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isAuthenticated, redirectIfAccessTokenExpired, requireAuth } from "./pageGuards";

describe("pageGuards", () => {
  describe("isAuthenticated", () => {
    it("returns true when user is logged in", async () => {
      const context = setup({
        session: {
          user: {
            id: faker.string.uuid()
          },
          accessTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
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

  describe("redirectIfAccessTokenExpired", () => {
    it("returns true when access token is not expired", async () => {
      const context = setup({
        session: {
          accessTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
        }
      });

      const result = await redirectIfAccessTokenExpired(context);

      expect(result).toBe(true);
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
          destination: expect.stringMatching(/^\/login/),
          permanent: false
        }
      });
    });
  });

  describe("requireAuth", () => {
    it("returns undefined when the user has a valid session", async () => {
      const context = setup({
        session: {
          user: {
            id: faker.string.uuid()
          },
          accessTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
        }
      });

      const result = await requireAuth(context);

      expect(result).toBeUndefined();
    });

    it("returns a /login redirect with returnTo when unauthenticated", async () => {
      const context = setup({
        session: undefined,
        resolvedUrl: "/billing?x=1"
      });

      const result = await requireAuth(context);

      expect(result).toEqual({
        redirect: {
          destination: "/login?tab=login&returnTo=%2Fbilling%3Fx%3D1",
          permanent: false
        }
      });
    });
  });
});

function setup(input?: { session?: Partial<Session>; resolvedUrl?: string }) {
  return mock<AppTypedContext>({
    getCurrentSession: vi.fn().mockImplementation(async () => {
      if (!input?.session) return null;
      return {
        ...input.session,
        accessTokenExpiresAt: input.session.accessTokenExpiresAt ? new Date(input.session.accessTokenExpiresAt).getTime() / 1000 : undefined
      };
    }),
    services: {
      logger: mock<LoggerService>(),
      urlService: UrlService
    },
    resolvedUrl: input?.resolvedUrl ?? faker.internet.url()
  });
}
