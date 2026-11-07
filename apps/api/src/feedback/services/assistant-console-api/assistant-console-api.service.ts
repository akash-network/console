import type { OpenAPIObject } from "openapi3-ts/oas30";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import {
  consoleApiCatalogOf,
  type ConsoleApiRoute,
  consoleApiRoutesOf,
  isAssistantReadablePath,
  publishedGetRoutesOf,
  readableConsoleApiRouteOf
} from "@src/feedback/lib/console-api-catalog/console-api-catalog";
import { projectedToSchema } from "@src/feedback/lib/openapi-projection/openapi-projection";
import { withoutPersonalData, withoutTeammatesPrivateFields } from "@src/feedback/lib/personal-data/personal-data";
import { REDACTED, redactEmailAddresses, redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import { CONSOLE_API, type ConsoleApi } from "@src/feedback/providers/console-api.provider";
import { AssistantAddressNamesService } from "@src/feedback/services/assistant-address-names/assistant-address-names.service";
import { AssistantUsdService, type Coin } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import { ORGANIZATION_ID_HEADER, PROJECT_ID_HEADER } from "@src/organization/services/organization-context/organization-context.resolver";

/** Leaves room for the tool name and the cut note inside the runner's result cap. */
export const MAX_READ_RESULT_LENGTH = 7_000;
const LIST_LENGTHS_TO_TRY = [20, 10, 5, 2];
const MAX_STRING_LENGTH = 1_000;
const MAX_ERROR_MESSAGE_LENGTH = 300;
const INTERNAL_ORIGIN = "http://assistant.internal";
const FORWARDED_CALLER_HEADERS = ["authorization", ORGANIZATION_ID_HEADER, PROJECT_ID_HEADER];
const SECRET_PROPERTY = /secret|token|password|passwd|mnemonic|private|credential|jwt|cert|receipt|api[_-]?key|key[_-]?format/i;
const PER_BLOCK_PRICE_PROPERTY = /^price$|per[_-]?block/i;
const AMOUNT_PROPERTY = /amount|balance|transferred|cost|price|allowance|funds|spent|limit|threshold/i;
const CHAIN_DENOMS = new Set(["uakt", "uact"]);
const CATALOG_UNAVAILABLE = "The Console API catalog could not be loaded, so read_console_api cannot be used right now.";

interface ReadResult {
  summary: string;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoin(value: unknown): value is Coin & Record<string, unknown> {
  return isRecord(value) && typeof value.denom === "string" && (typeof value.amount === "string" || typeof value.amount === "number");
}

function isPerBlockPrice(property: string): boolean {
  return PER_BLOCK_PRICE_PROPERTY.test(property);
}

function isDenominatedAmount(property: string, value: unknown): value is string | number {
  const isNumeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));
  return isNumeric && AMOUNT_PROPERTY.test(property) && !/usd/i.test(property);
}

function usdPropertyOf(property: string): string {
  return isPerBlockPrice(property) ? `${property}UsdPerMonth` : `${property}Usd`;
}

/** Only the message of an error body reaches the model, never the rest of what the route answered. */
function errorMessageOf(body: string): string {
  try {
    const { message } = JSON.parse(body) as { message?: unknown };
    return typeof message === "string" ? message : "";
  } catch {
    return body;
  }
}

function humanTagOf(tag: string): string {
  return tag
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(word => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(" ");
}

function unreadableRouteError(path: string): AssistantToolError {
  return new AssistantToolError(
    `${path} is not a route the assistant may read. Do not try it again; pick a path from the catalog, or tell the user where Console shows it.`
  );
}

export function readSummaryOf(route: ConsoleApiRoute): string {
  return route.forSignedInUser ? `Read your ${humanTagOf(route.tag)}` : `Read ${humanTagOf(route.tag)}`;
}

function shortenedOf(text: string): string {
  const redacted = redactEmailAddresses(text);
  return redacted.length > MAX_STRING_LENGTH ? `${redacted.slice(0, MAX_STRING_LENGTH)}...[truncated]` : redacted;
}

function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (!isRecord(value)) return typeof value === "string" ? shortenedOf(value) : value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SECRET_PROPERTY.test(key) ? REDACTED : withoutSecrets(entry)]));
}

function withListsCut(value: unknown, maxItems: number, cut: { lists: number }): unknown {
  if (Array.isArray(value)) {
    if (value.length > maxItems) cut.lists++;
    return value.slice(0, maxItems).map(item => withListsCut(item, maxItems, cut));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, withListsCut(entry, maxItems, cut)]));
}

/** Cuts long lists until the read fits, and says so, since a result cut mid-JSON would reach the model without its note. */
export function fittedReadOf(data: unknown): unknown {
  if (JSON.stringify(data).length <= MAX_READ_RESULT_LENGTH) return data;

  for (const maxItems of LIST_LENGTHS_TO_TRY) {
    const cut = { lists: 0 };
    const fitted = withListsCut(data, maxItems, cut);
    const result = { data: fitted, note: `Lists show their first ${maxItems} items. Narrow the query or page through it for the rest.` };
    if (JSON.stringify(result).length <= MAX_READ_RESULT_LENGTH) return result;
  }

  return { note: "The response is too large to read. Narrow it with query parameters or read a single item." };
}

/** Reads the listed GET routes of the Console API as the signed-in user, through the full app, so its own auth and ability checks decide what they see. */
@singleton()
export class AssistantConsoleApiService {
  #routes?: { document: OpenAPIObject; published: ConsoleApiRoute[]; readable: ConsoleApiRoute[] };

  constructor(
    @inject(CONSOLE_API) private readonly consoleApi: ConsoleApi,
    private readonly executionContextService: ExecutionContextService,
    private readonly addressNamesService: AssistantAddressNamesService,
    private readonly usdService: AssistantUsdService,
    private readonly authService: AuthService
  ) {}

  async catalog(): Promise<string> {
    return consoleApiCatalogOf((await this.#loadedRoutes()).readable);
  }

  async read({ path, query }: ReadToolArguments<"read_console_api">): Promise<ReadResult> {
    const route = await this.#routeOf(path);
    this.#assertDeclaredQuery(route, query);

    const response = await this.consoleApi.fetch(new Request(this.#urlOf(path, query), { method: "GET", headers: this.#callerHeaders() }));
    if (!response.ok) throw await this.#refusalOf(path, response);
    if (!response.headers.get("content-type")?.includes("application/json")) throw new AssistantToolError(`${path} does not answer with JSON data.`);

    return { summary: readSummaryOf(route), data: fittedReadOf(await this.#shaped(route, await response.json())) };
  }

  async #loadedRoutes(): Promise<{ published: ConsoleApiRoute[]; readable: ConsoleApiRoute[] }> {
    const document = await this.consoleApi.publishedDocument();
    if (this.#routes?.document !== document) this.#routes = { document, published: publishedGetRoutesOf(document), readable: consoleApiRoutesOf(document) };

    return this.#routes;
  }

  async #routeOf(path: string): Promise<ConsoleApiRoute> {
    if (!isAssistantReadablePath(path)) throw unreadableRouteError(path);

    const { published } = await this.#loadedRoutes().catch(() => {
      throw new Error(CATALOG_UNAVAILABLE);
    });
    const route = readableConsoleApiRouteOf(published, path);
    if (!route) throw unreadableRouteError(path);

    return route;
  }

  #assertDeclaredQuery(route: ConsoleApiRoute, query: Record<string, unknown> | undefined): void {
    const undeclared = Object.keys(query ?? {}).filter(name => !route.queryParameters.includes(name));
    if (undeclared.length === 0) return;

    const accepted = route.queryParameters.length > 0 ? `It accepts ${route.queryParameters.join(", ")}.` : "It accepts no query parameters.";
    throw new AssistantToolError(`${route.path} does not accept ${undeclared.join(", ")}. ${accepted}`);
  }

  #urlOf(path: string, query: Record<string, string | number | boolean> | undefined): URL {
    const url = new URL(path, INTERNAL_ORIGIN);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, String(value));

    return url;
  }

  /** The caller's own credentials and organization scope, never a credential of the API's own. */
  #callerHeaders(): Headers {
    const request = this.executionContextService.get("HTTP_CONTEXT")?.req;
    const headers = new Headers({ accept: "application/json" });

    for (const name of FORWARDED_CALLER_HEADERS) {
      const value = request?.header(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("authorization")) throw new Error("The assistant turn has no caller credentials to read the Console API with");

    return headers;
  }

  async #refusalOf(path: string, response: Response): Promise<Error> {
    if (response.status === 401 || response.status === 403) return new AssistantToolError(`The user cannot read ${path}.`);
    if (response.status === 404) return new AssistantToolError(`Nothing was found at ${path}.`);
    if (response.status >= 500) return new Error(`The Console API answered ${response.status}`);

    const message = redactEmailAddresses(redactSecrets(errorMessageOf(await response.text()))).slice(0, MAX_ERROR_MESSAGE_LENGTH);
    return new AssistantToolError(`The Console API refused ${path} with ${response.status}: ${message}`);
  }

  async #shaped(route: ConsoleApiRoute, body: unknown): Promise<unknown> {
    const projected = projectedToSchema(body, route.responseSchema, this.#routes?.document.components?.schemas);
    const published = withoutPersonalData(withoutTeammatesPrivateFields(route.path, projected, this.authService.currentUser.id));
    return await this.addressNamesService.withAddressesNamed(withoutSecrets(await this.#inUsd(published)));
  }

  /** Swaps every chain amount for dollars, so no denom or micro amount reaches the model to repeat. */
  async #inUsd(value: unknown, property = ""): Promise<unknown> {
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every(isCoin)) return await this.#usdFieldsOf(value, property);
      return await Promise.all(value.map(item => this.#inUsd(item)));
    }

    if (!isRecord(value)) return value;

    if (isCoin(value)) {
      const { denom, amount, ...rest } = value;
      return { ...(await this.#recordInUsd(rest)), ...(await this.#usdFieldsOf([{ denom, amount }], property)) };
    }

    return await this.#recordInUsd(value);
  }

  /** An amount beside a chain denom, such as a wallet's creditAmount, is in that denom's micro units. */
  async #recordInUsd(value: Record<string, unknown>): Promise<Record<string, unknown>> {
    const denom = typeof value.denom === "string" && CHAIN_DENOMS.has(value.denom) ? value.denom : null;
    const entries = await Promise.all(
      Object.entries(value)
        .filter(([key]) => !denom || key !== "denom")
        .map(async ([key, entry]) => {
          if (denom && isDenominatedAmount(key, entry)) return [usdPropertyOf(key), await this.#usdOf([{ denom, amount: entry }], key)] as const;
          return [key, await this.#inUsd(entry, key)] as const;
        })
    );

    return Object.fromEntries(entries);
  }

  async #usdFieldsOf(coins: Coin[], property: string): Promise<Record<string, number | null>> {
    return { [isPerBlockPrice(property) ? "usdPerMonth" : "usd"]: await this.#usdOf(coins, property) };
  }

  async #usdOf(coins: Coin[], property: string): Promise<number | null> {
    return isPerBlockPrice(property) ? await this.usdService.usdPerMonthOf(coins) : await this.usdService.usdOf(coins);
  }
}
