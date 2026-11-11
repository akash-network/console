import { faker } from "@faker-js/faker";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { inspectRoutes } from "hono/dev";
import { generateKeyPair, SignJWT } from "jose";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { INTERNAL_TOKEN_HEADER } from "@src/middlewares/internal-token/internal-token.middleware";
import { app } from "@src/rest-app";
import { apiRouter } from "@src/routers/apiRouter";
import { deploymentRouter } from "@src/routers/deploymentApiRouter";
import { internalRouter } from "@src/routers/internalRouter";
import { openApiHonoHandlers } from "@src/routers/open-api-handlers";
import {
  MIDDLEWARE_ONLY_REGISTRATIONS,
  ROUTES_CHECKING_SIGN_IN_IN_HANDLER,
  ROUTES_OPEN_WITHOUT_SIGN_IN,
  ROUTES_REQUIRING_INTERNAL_TOKEN,
  ROUTES_REQUIRING_PRIVATE_TOKEN
} from "./declared-route-security.routes";

const METHODS_SERVED_BY_ALL = ["GET", "POST", "PATCH", "DELETE"];

const unknownSigningKey = generateKeyPair("RS256");

describe("Declared route security", () => {
  const servedRoutes = listServedRoutes();
  const routesDeclaringSignIn = listRoutesDeclaringSignIn().filter(route => servedRoutes.includes(route));
  const signedOutCallers = [
    { caller: "with no credentials", headers: async () => ({}) },
    { caller: "with a malformed bearer token", headers: async () => ({ authorization: `Bearer ${faker.string.alphanumeric(40)}` }) },
    { caller: "with a bearer token not signed by the issuer", headers: async () => ({ authorization: `Bearer ${await signWithUnknownKey()}` }) },
    { caller: "with an unknown API key", headers: async () => ({ "x-api-key": container.resolve(ApiKeyGeneratorService).generateApiKey() }) }
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds the routes that declare sign-in", () => {
    expect(routesDeclaringSignIn).toContain("POST /v1/deployments");
    expect(routesDeclaringSignIn).toContain("POST /deployments/v1/deployments");
  });

  it("accounts for every served route as either declaring sign-in or listed with its access", () => {
    const listedRoutes = [
      ...ROUTES_OPEN_WITHOUT_SIGN_IN,
      ...ROUTES_REQUIRING_PRIVATE_TOKEN,
      ...ROUTES_REQUIRING_INTERNAL_TOKEN,
      ...ROUTES_CHECKING_SIGN_IN_IN_HANDLER
    ];
    const routesWithoutDeclaredSignIn = servedRoutes.filter(route => !routesDeclaringSignIn.includes(route));

    expect(routesWithoutDeclaredSignIn.filter(route => !listedRoutes.includes(route))).toEqual([]);
    expect(listedRoutes.filter(route => !routesWithoutDeclaredSignIn.includes(route))).toEqual([]);
    expect(new Set(listedRoutes).size).toBe(listedRoutes.length);
  });

  it("registers middleware without a handler only on the listed paths", () => {
    const registeredMiddleware = new Set(inspectRoutes(app).flatMap(route => (route.isMiddleware ? [`${route.method} ${route.path}`] : [])));

    expect([...registeredMiddleware].filter(route => !servedRoutes.includes(route)).sort()).toEqual([...MIDDLEWARE_ONLY_REGISTRATIONS].sort());
  });

  describe.each(signedOutCallers)("when the caller comes $caller", ({ headers }) => {
    it.each(toRequests(routesDeclaringSignIn))("answers $method $path with 401", async ({ method, path }) => {
      const { request } = setup();

      const response = await request({ method, path, headers: await headers() });

      expect(response.status).toBe(401);
    });
  });

  describe.each([
    { guard: "private token", routes: ROUTES_REQUIRING_PRIVATE_TOKEN },
    { guard: "internal token", routes: ROUTES_REQUIRING_INTERNAL_TOKEN }
  ])("routes requiring the $guard", ({ routes }) => {
    it.each(toRequests(routes))("answers $method $path with 401 to a caller without the token", async ({ method, path }) => {
      const { request } = setup();

      const response = await request({ method, path, headers: {} });

      expect(response.status).toBe(401);
    });

    it.each(toRequests(routes))("answers $method $path with 401 to a caller with a wrong token", async ({ method, path }) => {
      const { request } = setup();

      const response = await request({ method, path, headers: { [INTERNAL_TOKEN_HEADER]: faker.string.alphanumeric(32) } });

      expect(response.status).toBe(401);
    });
  });

  it.each(toRequests(ROUTES_CHECKING_SIGN_IN_IN_HANDLER))("refuses $method $path to a caller with no credentials", async ({ method, path }) => {
    const { request } = setup();

    const response = await request({ method, path, headers: {} });

    expect([401, 403]).toContain(response.status);
  });

  function setup() {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);

    const request = ({ method, path, headers }: { method: string; path: string; headers: Record<string, string> }) =>
      app.request(
        path,
        method === "GET" ? { method, headers } : { method, headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({}) }
      );

    return { request };
  }
});

function listServedRoutes() {
  return [...new Set(inspectRoutes(app).flatMap(route => (route.isMiddleware ? [] : [`${route.method} ${route.path}`])))];
}

function listRoutesDeclaringSignIn() {
  return [
    ...declaredRoutes([...openApiHonoHandlers, apiRouter], ""),
    ...declaredRoutes([internalRouter], "/internal"),
    ...declaredRoutes([deploymentRouter], "/deployments")
  ]
    .filter(route => route.security.length > 0)
    .map(route => `${route.method.toUpperCase()} ${route.path.replace(/\{([^}]+)\}/g, ":$1")}`);
}

function declaredRoutes(handlers: Array<Pick<OpenAPIHono, "openAPIRegistry">>, mountPath: string) {
  return handlers.flatMap(handler =>
    handler.openAPIRegistry.definitions.flatMap(definition =>
      definition.type === "route"
        ? [{ method: definition.route.method, path: `${mountPath}${definition.route.path}`, security: definition.route.security ?? [] }]
        : []
    )
  );
}

function toRequests(routes: string[]) {
  return routes.flatMap(route => {
    const [method, path] = route.split(" ");
    const requestPath = path.replace(/:[^/{?]+(\{[^}]+\})?\??/g, "1").replace(/\*/g, "1");

    return (method === "ALL" ? METHODS_SERVED_BY_ALL : [method]).map(requestMethod => ({ method: requestMethod, path: requestPath, route }));
  });
}

async function signWithUnknownKey() {
  const authConfig = container.resolve(AuthConfigService);
  const { privateKey } = await unknownSigningKey;

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(authConfig.get("AUTH0_ISSUER")[0])
    .setAudience(authConfig.get("AUTH0_AUDIENCE")[0])
    .setSubject(faker.string.uuid())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}
