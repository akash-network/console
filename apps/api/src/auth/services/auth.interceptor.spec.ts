import { Hono } from "hono";
import { mock } from "jest-mock-extended";
import { container as globalContainer } from "tsyringe";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { AbilityService } from "./ability/ability.service";
import { UserAuthTokenService } from "./user-auth-token/user-auth-token.service";
import { AuthInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(AuthInterceptor.name, () => {
  describe("Anonymous user", () => {
    includeMarkUserAsActiveTests(() => UserSeeder.create({ userId: null }));
  });

  describe("Regular user", () => {
    includeMarkUserAsActiveTests(() => UserSeeder.create());
  });

  describe("API key user", () => {
    it("marks user and its api key as active once per 30 minutes", async () => {
      const { di, callInterceptor } = setup({ apiKey: "123", user: UserSeeder.create() });

      await Promise.all([callInterceptor(), callInterceptor()]);
      await callInterceptor();
      await callInterceptor();

      expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(1);
      expect(di.resolve(ApiKeyRepository).markAsUsed).toHaveBeenCalledTimes(1);
    });

    it("marks user and its api key as active again after 30 minutes", async () => {
      const { di, callInterceptor } = setup({ apiKey: "123", user: UserSeeder.create() });

      await callInterceptor();
      await callInterceptor();

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date(Date.now() + 25 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        jest.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();
        expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  function includeMarkUserAsActiveTests(createUser: () => UserOutput) {
    it("marks user as active once per 30 minutes", async () => {
      const { di, callInterceptor } = setup({ user: createUser() });

      await Promise.all([callInterceptor(), callInterceptor()]);
      await callInterceptor();
      await callInterceptor();

      expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(1);
    });

    it("marks user as active again after 30 minutes", async () => {
      const { di, callInterceptor } = setup({ user: createUser() });

      await callInterceptor();
      await callInterceptor();

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date(Date.now() + 25 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        jest.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  }

  function setup(input?: SetupInput) {
    const di = globalContainer.createChildContainer();

    di.registerInstance(AbilityService, mock());
    di.registerInstance(
      UserRepository,
      mock<UserRepository>({
        findAnonymousById: jest.fn().mockImplementation(async () => input?.user ?? UserSeeder.create()),
        findByUserId: jest.fn().mockImplementation(async () => input?.user ?? UserSeeder.create()),
        findById: jest.fn().mockImplementation(async () => input?.user ?? UserSeeder.create()),
        markAsActive: jest.fn()
      })
    );
    di.registerInstance(AuthService, mock());
    di.registerInstance(
      AuthTokenService,
      mock<AuthTokenService>({
        getValidUserId: jest.fn().mockImplementation(async () => {
          return input?.apiKey && input?.user?.userId ? undefined : input?.user?.id;
        })
      })
    );
    di.registerInstance(
      UserAuthTokenService,
      mock<UserAuthTokenService>({
        getValidUserId: jest.fn().mockImplementation(async () => (input?.apiKey ? undefined : input?.user?.userId))
      })
    );
    di.registerInstance(ApiKeyRepository, mock());
    di.registerInstance(
      ApiKeyAuthService,
      mock<ApiKeyAuthService>({
        getAndValidateApiKeyFromHeader: jest.fn().mockImplementation(async () => ({
          id: "123",
          userId: input?.user?.id
        }))
      })
    );
    di.register(AuthInterceptor, { useClass: AuthInterceptor });

    const app = new Hono().use(di.resolve(AuthInterceptor).intercept()).get("/", c => c.text("Ok"));
    const headers: Record<string, string> = {};

    if (input?.user) {
      headers.authorization = `Bearer ${input.user.userId}`;
    }

    if (input?.apiKey) {
      headers["x-api-key"] = input.apiKey;
    }

    return {
      di,
      callInterceptor: () =>
        app.request("/", {
          headers
        })
    };
  }

  interface SetupInput {
    user?: UserOutput;
    apiKey?: string;
  }
});
