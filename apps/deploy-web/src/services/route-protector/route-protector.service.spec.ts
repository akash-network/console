import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";
import type { GetServerSidePropsContext } from "next";

import type { FeatureFlagService } from "../feature-flag/feature-flag.service";
import { RouteProtectorService } from "./route-protector.service";

describe(RouteProtectorService.name, () => {
  describe("showToRegisteredUserIfEnabled", () => {
    it("returns props when feature is enabled and user is logged in", async () => {
      const { service, context } = setup({
        isFeatureEnabled: true,
        hasUserSession: true
      });

      const featureName = faker.word.sample();
      const result = await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(result).toEqual({ props: {} });
    });

    it("returns notFound when feature is enabled but user is not logged in", async () => {
      const { service, context } = setup({
        isFeatureEnabled: true,
        hasUserSession: false
      });

      const featureName = faker.word.sample();
      const result = await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(result).toEqual({ notFound: true });
    });

    it("returns notFound when feature is disabled but user is logged in", async () => {
      const { service, context } = setup({
        isFeatureEnabled: false,
        hasUserSession: true
      });

      const featureName = faker.word.sample();
      const result = await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(result).toEqual({ notFound: true });
    });

    it("returns notFound when both feature is disabled and user is not logged in", async () => {
      const { service, context } = setup({
        isFeatureEnabled: false,
        hasUserSession: false
      });

      const featureName = faker.word.sample();
      const result = await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(result).toEqual({ notFound: true });
    });

    it("calls feature flag service with correct parameters", async () => {
      const { service, context, featureFlagService } = setup({
        isFeatureEnabled: true,
        hasUserSession: true
      });

      const featureName = faker.word.sample();
      await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(featureFlagService.isEnabledForCtx).toHaveBeenCalledWith(featureName, context);
    });

    it("calls getSession with request and response objects", async () => {
      const { service, context, getSession } = setup({
        isFeatureEnabled: true,
        hasUserSession: true
      });

      const featureName = faker.word.sample();
      await service.showToRegisteredUserIfEnabled(featureName)(context);

      expect(getSession).toHaveBeenCalledWith(context.req, context.res);
    });
  });

  function setup(options: { isFeatureEnabled: boolean; hasUserSession: boolean }) {
    const featureFlagService = mock<FeatureFlagService>();
    featureFlagService.isEnabledForCtx.mockResolvedValue(options.isFeatureEnabled);

    const getSession = jest.fn().mockResolvedValue(
      options.hasUserSession
        ? {
            user: {
              sub: faker.string.uuid(),
              email: faker.internet.email(),
              name: faker.person.fullName(),
              picture: faker.image.avatar()
            }
          }
        : null
    );

    const service = new RouteProtectorService(featureFlagService, getSession);

    const context = {
      req: {
        headers: {
          cookie: faker.string.sample(),
          host: faker.internet.domainName()
        },
        url: faker.internet.url()
      },
      res: {
        setHeader: jest.fn(),
        getHeader: jest.fn()
      }
    } as unknown as GetServerSidePropsContext;

    return { service, featureFlagService, getSession, context };
  }
});
