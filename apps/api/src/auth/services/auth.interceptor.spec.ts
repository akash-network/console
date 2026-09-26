import { type Span, trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { isHttpError } from "http-errors";
import { container as globalContainer } from "tsyringe";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { AbilityService } from "./ability/ability.service";
import { UserAuthTokenService } from "./user-auth-token/user-auth-token.service";
import { AuthInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";

import { createUser } from "@test/seeders/user.seeder";

describe(AuthInterceptor.name, () => {
  describe("Regular user", () => {
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

      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(Date.now() + 25 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        vi.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Mutually exclusive headers", () => {
    it("rejects request with both Authorization and X-Api-Key headers", async () => {
      const { callInterceptor } = setup({ bearer: "Bearer some-token", apiKey: "some-api-key" });

      const response = await callInterceptor();

      expect(response.status).toBe(400);
    });
  });

  describe("Invalid bearer token", () => {
    it("proceeds as unauthenticated when getValidUserId returns null", async () => {
      const { di, callInterceptor } = setup({ bearer: "Bearer invalid-token", tokenBehavior: "null" });

      const response = await callInterceptor();

      expect(response.status).toBe(200);
      expect(di.resolve(UserRepository).findByUserId).not.toHaveBeenCalled();
    });

    it("proceeds as unauthenticated when getValidUserId throws", async () => {
      const { di, callInterceptor } = setup({ bearer: "Bearer malformed-token", tokenBehavior: "throw" });

      const response = await callInterceptor();

      expect(response.status).toBe(200);
      expect(di.resolve(UserRepository).findByUserId).not.toHaveBeenCalled();
    });
  });

  describe("API key user", () => {
    it("marks user and its api key as active once per 30 minutes", async () => {
      const { di, callInterceptor } = setup({ apiKey: "123", user: createUser() });

      await Promise.all([callInterceptor(), callInterceptor()]);
      await callInterceptor();
      await callInterceptor();

      expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(1);
      expect(di.resolve(ApiKeyRepository).markAsUsed).toHaveBeenCalledTimes(1);
    });

    it("marks user and its api key as active again after 30 minutes", async () => {
      const { di, callInterceptor } = setup({ apiKey: "123", user: createUser() });

      await callInterceptor();
      await callInterceptor();

      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(Date.now() + 25 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();

        vi.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
        await callInterceptor();
        await callInterceptor();
        expect(di.resolve(UserRepository).markAsActive).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Auth method", () => {
    it("records bearer on the request context and the request span for a session request", async () => {
      const { callInterceptor, observedAuthMethods, requestSpan } = setup({ user: createUser() });

      await callInterceptor();

      expect(observedAuthMethods).toEqual(["bearer"]);
      expect(requestSpan.setAttribute).toHaveBeenCalledWith("auth.method", "bearer");
    });

    it("records api_key on the request context and the request span for an API key request", async () => {
      const { callInterceptor, observedAuthMethods, requestSpan } = setup({ apiKey: "123", user: createUser() });

      await callInterceptor();

      expect(observedAuthMethods).toEqual(["api_key"]);
      expect(requestSpan.setAttribute).toHaveBeenCalledWith("auth.method", "api_key");
    });

    it("records api_key for a request whose API key is rejected", async () => {
      const { callInterceptor, observedAuthMethods } = setup({ apiKey: "123", user: createUser(), apiKeyBehavior: "throw" });

      const response = await callInterceptor();

      expect(response.status).toBe(401);
      expect(observedAuthMethods).toEqual(["api_key"]);
    });

    it("records none for a request without credentials", async () => {
      const { callInterceptor, observedAuthMethods, requestSpan } = setup();

      await callInterceptor();

      expect(observedAuthMethods).toEqual(["none"]);
      expect(requestSpan.setAttribute).toHaveBeenCalledWith("auth.method", "none");
    });

    it("records the auth method on the request context when no request span is active", async () => {
      const { callInterceptor, observedAuthMethods } = setup({ user: createUser(), withoutRequestSpan: true });

      const response = await callInterceptor();

      expect(response.status).toBe(200);
      expect(observedAuthMethods).toEqual(["bearer"]);
    });
  });

  function setup(input?: SetupInput) {
    const di = globalContainer.createChildContainer();
    const requestSpan = mock<Span>();
    const getActiveSpan = vi.spyOn(trace, "getActiveSpan").mockReturnValue(input?.withoutRequestSpan ? undefined : requestSpan);
    onTestFinished(() => getActiveSpan.mockRestore());
    const observedAuthMethods: unknown[] = [];

    di.registerInstance(AbilityService, mock());
    di.registerInstance(
      UserRepository,
      mock<UserRepository>({
        findByUserId: vi.fn().mockImplementation(async () => input?.user ?? createUser()),
        findById: vi.fn().mockImplementation(async () => input?.user ?? createUser()),
        markAsActive: vi.fn()
      })
    );
    di.registerInstance(AuthService, mock());
    di.registerInstance(
      UserAuthTokenService,
      mock<UserAuthTokenService>({
        getValidUserId: vi.fn().mockImplementation(async () => {
          if (input?.tokenBehavior === "throw") {
            throw new Error("Invalid token");
          }
          if (input?.tokenBehavior === "null") {
            return null;
          }
          return input?.apiKey ? undefined : input?.user?.userId;
        })
      })
    );
    di.registerInstance(ApiKeyRepository, mock());
    di.registerInstance(
      ApiKeyAuthService,
      mock<ApiKeyAuthService>({
        getAndValidateApiKeyFromHeader: vi.fn().mockImplementation(async () => {
          if (input?.apiKeyBehavior === "throw") {
            throw new Error("Invalid API key");
          }
          return { id: "123", userId: input?.user?.id };
        })
      })
    );
    di.register(AuthInterceptor, { useClass: AuthInterceptor });
    di.register(ExecutionContextService, {
      useValue: mock<ExecutionContextService>({
        get: key =>
          (
            ({
              HTTP_CONTEXT: {
                var: {
                  clientInfo: {
                    ip: "127.0.0.1",
                    fingerprint: "123"
                  }
                }
              }
            }) as any
          )[key]
      })
    });

    const app = new Hono<{ Variables: { authMethod?: string } }>()
      .onError((error, c) => {
        if (isHttpError(error)) {
          return c.json({ error: error.message }, { status: error.status });
        }
        throw error;
      })
      .use(async (c, next) => {
        await next();
        observedAuthMethods.push(c.get("authMethod"));
      })
      .use(di.resolve(AuthInterceptor).intercept())
      .get("/", c => c.text("Ok"));
    const headers: Record<string, string> = {};

    if (input?.bearer) {
      headers.authorization = input.bearer;
    } else if (input?.user && !input?.apiKey) {
      headers.authorization = `Bearer ${input.user.userId}`;
    }

    if (input?.apiKey) {
      headers["x-api-key"] = input.apiKey;
    }

    return {
      di,
      requestSpan,
      observedAuthMethods,
      callInterceptor: () =>
        app.request("/", {
          headers
        })
    };
  }

  interface SetupInput {
    user?: UserOutput;
    apiKey?: string;
    bearer?: string;
    tokenBehavior?: "null" | "throw";
    apiKeyBehavior?: "throw";
    withoutRequestSpan?: boolean;
  }
});
