import type { OpenAPIObject } from "openapi3-ts/oas30";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { ConsoleApi } from "@src/feedback/providers/console-api.provider";
import type { AssistantAddressNamesService } from "@src/feedback/services/assistant-address-names/assistant-address-names.service";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import { AssistantConsoleApiService, fittedReadOf, MAX_READ_RESULT_LENGTH, readSummaryOf } from "./assistant-console-api.service";

const BEARER = [{ BearerAuth: [] }];
const PROVIDER = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";

function jsonOf(content: unknown) {
  return { description: "ok", content: { "application/json": { schema: content } } };
}

const DOCUMENT: OpenAPIObject = {
  openapi: "3.0.0",
  info: { title: "Console API", version: "v1" },
  paths: {
    "/v1/projects": {
      get: {
        tags: ["Projects"],
        summary: "List the projects",
        security: BEARER,
        parameters: [{ name: "limit", in: "query" }],
        responses: { 200: jsonOf({ $ref: "#/components/schemas/Projects" }) }
      }
    },
    "/v1/api-keys": { get: { tags: ["API Keys"], security: BEARER, responses: {} } },
    "/v1/leases": { get: { tags: ["Leases"], security: BEARER, responses: {} } },
    "/v1/wallets": { get: { tags: ["Wallet"], security: BEARER, responses: {} } },
    "/v1/providers/{address}": { get: { tags: ["Providers"], summary: "Get a provider", responses: {} } },
    "/v1/deployments/{dseq}": { get: { tags: ["Deployments"], security: BEARER, responses: {} } }
  },
  components: {
    schemas: {
      Projects: {
        type: "object",
        properties: { data: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } } } }
      }
    }
  }
};

describe(AssistantConsoleApiService.name, () => {
  describe("catalog", () => {
    it("lists the allowed GET routes of the published document", async () => {
      const { service } = setup();

      expect(await service.catalog()).toBe(
        [
          "Projects: /v1/projects?limit List the projects",
          "API Keys: /v1/api-keys",
          "Leases: /v1/leases",
          "Wallet: /v1/wallets",
          "Providers: /v1/providers/{address} Get a provider"
        ].join("\n")
      );
    });
  });

  describe("read", () => {
    it("reads the route as the caller, through the API app, with their credentials and organization scope", async () => {
      const { service, consoleApi } = setup({ body: { data: [{ id: "p1", name: "Production", ownerUserId: "u1" }] } });

      const result = await service.read({ path: "/v1/projects", query: { limit: 5 } });

      const request = consoleApi.fetch.mock.calls[0][0];
      expect(request.method).toBe("GET");
      expect(new URL(request.url).pathname + new URL(request.url).search).toBe("/v1/projects?limit=5");
      expect(Object.fromEntries(request.headers)).toEqual({
        accept: "application/json",
        authorization: "Bearer user-token",
        "x-organization-id": "org-1",
        "x-project-id": "project-1"
      });
      expect(result).toEqual({ summary: "Read your projects", data: { data: [{ id: "p1", name: "Production" }] } });
    });

    it("forwards only the caller headers the request carries", async () => {
      const { service, consoleApi } = setup({ headers: { authorization: "Bearer user-token" } });

      await service.read({ path: "/v1/projects" });

      expect(Object.fromEntries(consoleApi.fetch.mock.calls[0][0].headers)).toEqual({ accept: "application/json", authorization: "Bearer user-token" });
    });

    it("redacts secret fields and names addresses in what it read", async () => {
      const { service, addressNamesService } = setup({
        body: { data: [{ name: "ci", keyFormat: "ac.sk.prod.abc***xyz", receiptUrl: "https://pay.stripe.com/r/1", nested: { provider: PROVIDER } }] }
      });

      const { data } = await service.read({ path: "/v1/api-keys" });

      expect(data).toEqual({ data: [{ name: "ci", keyFormat: REDACTED, receiptUrl: REDACTED, nested: { provider: "provider provider.europlots.com" } }] });
      expect(addressNamesService.withAddressesNamed).toHaveBeenCalledTimes(1);
    });

    it("keeps the attribute names a provider read returns", async () => {
      const { service } = setup({ body: { attributes: [{ key: "region", value: "us-west" }] } });

      const { data } = await service.read({ path: `/v1/providers/${PROVIDER}` });

      expect(data).toEqual({ attributes: [{ key: "region", value: "us-west" }] });
    });

    it("states chain amounts in dollars, per month for per-block prices, and drops their denoms", async () => {
      const { service } = setup({
        aktPrice: 0.5,
        body: {
          lease: { price: { denom: "uact", amount: "2.93" }, state: "active" },
          escrow: { funds: [{ denom: "uact", amount: "5000000" }], transferred: [{ denom: "uakt", amount: "2000000" }] },
          spendLimit: [{ denom: "uact", amount: "3000000" }],
          wallet: { creditAmount: 25_000_000, denom: "uact", trialDurationDays: 30, topUpMinAmountUsd: 20 },
          grant: { denom: "uakt", amount: 4_000_000, granter: "console" },
          other: { denom: "usd", amount: 7 },
          empty: [],
          names: ["web"]
        }
      });

      const { data } = await service.read({ path: "/v1/leases" });

      expect(data).toEqual({
        lease: { price: { usdPerMonth: 1.28 }, state: "active" },
        escrow: { funds: { usd: 5 }, transferred: { usd: 1 } },
        spendLimit: { usd: 3 },
        wallet: { creditAmountUsd: 25, trialDurationDays: 30, topUpMinAmountUsd: 20 },
        grant: { granter: "console", usd: 2 },
        other: { usd: null },
        empty: [],
        names: ["web"]
      });
    });

    it("prices a per-block amount beside a denom per month", async () => {
      const { service } = setup({ body: { deployments: [{ dseq: "42", denom: "uact", price: "2.93", pricePerBlock: 1, note: "12" }] } });

      expect((await service.read({ path: "/v1/leases" })).data).toEqual({
        deployments: [{ dseq: "42", priceUsdPerMonth: 1.28, pricePerBlockUsdPerMonth: 0.44, note: "12" }]
      });
    });

    it("labels a public route without saying it is the user's", async () => {
      const { service } = setup();

      expect((await service.read({ path: `/v1/providers/${PROVIDER}` })).summary).toBe("Read providers");
    });

    it("refuses a denied route before looking anything up", async () => {
      const { service, consoleApi } = setup();

      await expect(service.read({ path: "/v1/deployments/42" })).rejects.toThrow(
        new AssistantToolError("/v1/deployments/42 is not available to the assistant. Do not try it again; tell the user where Console shows it instead.")
      );
      expect(consoleApi.publishedDocument).not.toHaveBeenCalled();
      expect(consoleApi.fetch).not.toHaveBeenCalled();
    });

    it("refuses a path that matches no route in the catalog", async () => {
      const { service, consoleApi } = setup();

      await expect(service.read({ path: "/internal/financial" })).rejects.toThrow(
        new AssistantToolError("/internal/financial is not a GET route in the catalog. Pick a path from the catalog and fill its {parameters}.")
      );
      expect(consoleApi.fetch).not.toHaveBeenCalled();
    });

    it("refuses query parameters the route does not declare, naming the ones it accepts", async () => {
      const { service, consoleApi } = setup();

      await expect(service.read({ path: "/v1/projects", query: { limit: 1, ownerId: "x" } })).rejects.toThrow(
        new AssistantToolError("/v1/projects does not accept ownerId. It accepts limit.")
      );
      await expect(service.read({ path: "/v1/leases", query: { all: true } })).rejects.toThrow(
        new AssistantToolError("/v1/leases does not accept all. It accepts no query parameters.")
      );
      expect(consoleApi.fetch).not.toHaveBeenCalled();
    });

    it("fails when the published document cannot be loaded", async () => {
      const { service, consoleApi } = setup();
      consoleApi.publishedDocument.mockRejectedValue(new Error("notifications spec timed out"));

      const error = await service.read({ path: "/v1/projects" }).catch((error: unknown) => error);

      expect(error).toEqual(new Error("The Console API catalog could not be loaded, so read_console_api cannot be used right now."));
      expect(error).not.toBeInstanceOf(AssistantToolError);
    });

    it("fails without caller credentials instead of reading with any other", async () => {
      const { service, consoleApi } = setup({ headers: {} });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow("The assistant turn has no caller credentials to read the Console API with");
      expect(consoleApi.fetch).not.toHaveBeenCalled();
    });

    it("fails outside of a request", async () => {
      const { service } = setup({ headers: null });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow("The assistant turn has no caller credentials to read the Console API with");
    });

    it.each([
      [401, "The user cannot read /v1/projects."],
      [403, "The user cannot read /v1/projects."],
      [404, "Nothing was found at /v1/projects."]
    ])("hands a %s back to the model", async (status, message) => {
      const { service } = setup({ response: new Response("{}", { status }) });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow(new AssistantToolError(message));
    });

    it("hands another client error back with only its message, redacted", async () => {
      const { service } = setup({ response: Response.json({ message: "bad limit, password=hunter2", data: { owner: "u1" } }, { status: 400 }) });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow(
        new AssistantToolError(`The Console API refused /v1/projects with 400: bad limit, password=${REDACTED}`)
      );
    });

    it("bounds a plain text client error and passes none from a JSON body without a message", async () => {
      const { service } = setup({ response: new Response("x".repeat(400), { status: 422 }) });
      const { service: jsonService } = setup({ response: Response.json({ error: "Unprocessable" }, { status: 422 }) });

      const error = (await service.read({ path: "/v1/projects" }).catch((error: unknown) => error)) as AssistantToolError;

      expect(error.message).toBe(`The Console API refused /v1/projects with 422: ${"x".repeat(300)}`);
      await expect(jsonService.read({ path: "/v1/projects" })).rejects.toThrow(new AssistantToolError("The Console API refused /v1/projects with 422: "));
    });

    it("treats a server error as a failure the model does not see", async () => {
      const { service } = setup({ response: new Response("boom", { status: 502 }) });

      const error = await service.read({ path: "/v1/projects" }).catch((error: unknown) => error);

      expect(error).toEqual(new Error("The Console API answered 502"));
      expect(error).not.toBeInstanceOf(AssistantToolError);
    });

    it("refuses a route that does not answer with JSON", async () => {
      const { service } = setup({ response: new Response("id,amount", { status: 200, headers: { "content-type": "text/csv" } }) });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow(new AssistantToolError("/v1/projects does not answer with JSON data."));
    });

    it("refuses a route that answers with no content type", async () => {
      const { service } = setup({ response: new Response(null, { status: 200 }) });

      await expect(service.read({ path: "/v1/projects" })).rejects.toThrow(new AssistantToolError("/v1/projects does not answer with JSON data."));
    });
  });

  describe(readSummaryOf.name, () => {
    it("words a tag as the user reads it", () => {
      const route = { path: "/v1/x", summary: "", queryParameters: [], forSignedInUser: true };

      expect(readSummaryOf({ ...route, tag: "API Keys" })).toBe("Read your API keys");
      expect(readSummaryOf({ ...route, tag: "NotificationChannel" })).toBe("Read your notification channel");
      expect(readSummaryOf({ ...route, tag: "Gpu", forSignedInUser: false })).toBe("Read gpu");
    });
  });

  describe(fittedReadOf.name, () => {
    it("keeps a read that fits as it is, with long strings cut", () => {
      expect(fittedReadOf({ data: [{ id: 1 }] })).toEqual({ data: [{ id: 1 }] });
    });

    it("cuts long lists until the read fits, and says so", () => {
      const items = Array.from({ length: 50 }, (_, index) => ({ id: index, description: "x".repeat(250) }));

      const fitted = fittedReadOf({ data: items }) as { data: { data: unknown[] }; note: string };

      expect(fitted.data.data).toHaveLength(20);
      expect(fitted.note).toBe("Lists show their first 20 items. Narrow the query or page through it for the rest.");
      expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(MAX_READ_RESULT_LENGTH);
    });

    it("cuts deeper when the first cut does not fit", () => {
      const items = Array.from({ length: 30 }, (_, index) => ({ id: index, description: "x".repeat(600) }));

      const fitted = fittedReadOf(items) as { data: unknown[]; note: string };

      expect(fitted.data).toHaveLength(10);
      expect(fitted.note).toContain("first 10 items");
    });

    it("gives up with a note when even the smallest cut does not fit", () => {
      expect(fittedReadOf({ description: "x".repeat(MAX_READ_RESULT_LENGTH) })).toEqual({
        note: "The response is too large to read. Narrow it with query parameters or read a single item."
      });
    });
  });

  function setup(
    input: {
      body?: unknown;
      response?: Response;
      headers?: Record<string, string> | null;
      aktPrice?: number;
    } = {}
  ) {
    const consoleApi = mock<ConsoleApi>();
    consoleApi.publishedDocument.mockResolvedValue(DOCUMENT);
    consoleApi.fetch.mockImplementation(async () => input.response ?? Response.json(input.body ?? { data: [] }));

    const headers =
      input.headers === undefined ? { authorization: "Bearer user-token", "x-organization-id": "org-1", "x-project-id": "project-1" } : input.headers;
    const httpContext = { req: { header: (name: string) => headers?.[name] } };
    const getFromContext = (key: string) => (key === "HTTP_CONTEXT" && headers !== null ? httpContext : undefined);
    const executionContextService = mock<ExecutionContextService>({ get: getFromContext as ExecutionContextService["get"] });

    const addressNamesService = mock<AssistantAddressNamesService>();
    addressNamesService.withAddressesNamed.mockImplementation(async text => text.replaceAll(PROVIDER, "provider provider.europlots.com"));

    const denomExchangeService = mock<DenomExchangeService>();
    denomExchangeService.getExchangeRateToUSD.mockResolvedValue(
      mock<Awaited<ReturnType<DenomExchangeService["getExchangeRateToUSD"]>>>({ price: input.aktPrice ?? 1 })
    );

    const service = new AssistantConsoleApiService(consoleApi, executionContextService, addressNamesService, new AssistantUsdService(denomExchangeService));

    return { service, consoleApi, addressNamesService };
  }
});
