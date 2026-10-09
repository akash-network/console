import { faker } from "@faker-js/faker";
import { type Span, trace } from "@opentelemetry/api";
import { Hono } from "hono";
import createError, { isHttpError } from "http-errors";
import { container as globalContainer } from "tsyringe";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationContextResolver } from "@src/organization/services/organization-context/organization-context.resolver";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { AbilityService } from "./ability/ability.service";
import { UserAuthTokenService } from "./user-auth-token/user-auth-token.service";
import { AuthInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
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

    it("records api_key for a request rejected for carrying both an API key and a bearer token", async () => {
      const { callInterceptor, observedAuthMethods } = setup({ bearer: "Bearer some-token", apiKey: "some-api-key" });

      const response = await callInterceptor();

      expect(response.status).toBe(400);
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

  describe("Organization context", () => {
    it("stores the organization context resolved for a signed-in user before building the ability", async () => {
      const user = createUser();
      const projectId = faker.string.uuid();
      const { callInterceptor, organizationContextResolver, executionContextService, abilityService, organizationContext } = setup({
        user,
        headers: { "x-organization-id": "acme", "x-project-id": projectId }
      });

      await callInterceptor();

      expect(organizationContextResolver.resolve).toHaveBeenCalledWith({ user, apiKey: undefined, organizationHeader: "acme", projectHeader: projectId });
      expect(executionContextService.set).toHaveBeenCalledWith("ORGANIZATION_CONTEXT", organizationContext);
      expect(executionContextService.set.mock.invocationCallOrder[0]).toBeLessThan(abilityService.getAbilityFor.mock.invocationCallOrder[0]);
    });

    it("resolves an API key request with the organization and project the key is bound to", async () => {
      const user = createUser();
      const apiKeyOutput = createApiKey({ userId: user.id, organizationId: faker.string.uuid(), projectId: faker.string.uuid() });
      const { callInterceptor, organizationContextResolver, executionContextService, organizationContext } = setup({ apiKey: "123", user, apiKeyOutput });

      const response = await callInterceptor();

      expect(response.status).toBe(200);
      expect(organizationContextResolver.resolve).toHaveBeenCalledWith({ user, apiKey: apiKeyOutput, organizationHeader: undefined, projectHeader: undefined });
      expect(executionContextService.set).toHaveBeenCalledWith("ORGANIZATION_CONTEXT", organizationContext);
    });

    it("answers an API key request with the organization context's rejection rather than as an invalid key", async () => {
      const { callInterceptor, abilityService } = setup({ apiKey: "123", user: createUser(), organizationContextRejection: createError(400, "Mismatch") });

      const response = await callInterceptor();

      expect(response.status).toBe(400);
      expect(abilityService.getAbilityFor).not.toHaveBeenCalled();
    });

    it("answers a signed-in request with the organization context's rejection", async () => {
      const { callInterceptor } = setup({ user: createUser(), organizationContextRejection: createError(403, "Forbidden") });

      const response = await callInterceptor();

      expect(response.status).toBe(403);
    });

    it("resolves no organization context for an anonymous request", async () => {
      const { callInterceptor, organizationContextResolver, executionContextService } = setup();

      const response = await callInterceptor();

      expect(response.status).toBe(200);
      expect(organizationContextResolver.resolve).not.toHaveBeenCalled();
      expect(executionContextService.set).not.toHaveBeenCalled();
    });
  });

  function setup(input?: SetupInput) {
    const di = globalContainer.createChildContainer();
    const requestSpan = mock<Span>();
    const getActiveSpan = vi.spyOn(trace, "getActiveSpan").mockReturnValue(input?.withoutRequestSpan ? undefined : requestSpan);
    onTestFinished(() => getActiveSpan.mockRestore());
    const observedAuthMethods: unknown[] = [];

    const abilityService = mock<AbilityService>();
    di.registerInstance(AbilityService, abilityService);
    const organizationContext = createOrganizationContext();
    const organizationContextResolver = mock<OrganizationContextResolver>({
      resolve: input?.organizationContextRejection
        ? vi.fn().mockRejectedValue(input.organizationContextRejection)
        : vi.fn().mockResolvedValue(organizationContext)
    });
    di.registerInstance(OrganizationContextResolver, organizationContextResolver);
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
          return input?.apiKeyOutput ?? { id: "123", userId: input?.user?.id };
        })
      })
    );
    di.register(AuthInterceptor, { useClass: AuthInterceptor });
    const executionContextService = mock<ExecutionContextService>({
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
    });
    di.register(ExecutionContextService, { useValue: executionContextService });

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
    const headers: Record<string, string> = { ...input?.headers };

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
      abilityService,
      executionContextService,
      organizationContextResolver,
      organizationContext,
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
    apiKeyOutput?: ApiKeyOutput;
    headers?: Record<string, string>;
    organizationContextRejection?: Error;
  }
});
