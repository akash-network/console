import groupBy from "lodash/groupBy";
import type { OpenAPIObject, OperationObject, ParameterObject, ReferenceObject, SchemaObject } from "openapi3-ts/oas30";

export type ResponseSchema = SchemaObject | ReferenceObject;

export interface ConsoleApiRoute {
  path: string;
  tag: string;
  summary: string;
  queryParameters: string[];
  forSignedInUser: boolean;
  responseSchema?: ResponseSchema;
}

const SEALS_SECRETS = "returns the key context that seals SDL secrets";
const TEMPLATE_ENV = "returns saved template SDLs that can hold plaintext env values; list_templates covers templates";
const PLAINTEXT_ENV = "returns the stored SDL with its plaintext env values; get_deployment reads it without them";
const STRIPE_ON_READ = "calls Stripe on every read and returns raw payment details";
const NOT_JSON = "streams a CSV export instead of JSON";
const AUTH0_ON_READ = "calls the rate-limited Auth0 Management API on every read";
const ASSISTANT_PLUMBING = "belongs to the assistant and feedback prompts, not to the user's account";
const CHAIN_NODE_FALLBACK = "chain node fallback plumbing that duplicates the deployment and lease routes";
const CHAIN_DENOMINATED = "network explorer data in chain denoms and blocks, which the assistant never states";

/** GET routes the assistant never reads, whoever asks, each with the reason a reviewer can check. */
export const DENIED_CONSOLE_API_ROUTES: Readonly<Record<string, string>> = {
  "/v1/sdl-secrets-context": SEALS_SECRETS,
  "/v1/deployments/{dseq}": PLAINTEXT_ENV,
  "/v1/deployment-settings/{userId}/{dseq}": PLAINTEXT_ENV,
  "/v2/deployment-settings/{dseq}": PLAINTEXT_ENV,
  "/v1/user/template/{id}": TEMPLATE_ENV,
  "/v1/user/templates/{username}": TEMPLATE_ENV,
  "/v1/stripe/payment-methods": "syncs the payment method rows with Stripe on every read",
  "/v1/stripe/payment-methods/default": STRIPE_ON_READ,
  "/v1/billing-details": STRIPE_ON_READ,
  "/v1/stripe/prices": STRIPE_ON_READ,
  "/v1/stripe/transactions/export": NOT_JSON,
  "/v1/received-invitations": AUTH0_ON_READ,
  "/v1/assistant/consent": ASSISTANT_PLUMBING,
  "/v1/feedback/outcome-prompts/{dseq}": ASSISTANT_PLUMBING,
  "/akash/deployment/{version}/deployments/info": CHAIN_NODE_FALLBACK,
  "/akash/deployment/{version}/deployments/list": CHAIN_NODE_FALLBACK,
  "/akash/market/{version}/leases/list": CHAIN_NODE_FALLBACK,
  "/v1/balances": CHAIN_DENOMINATED,
  "/v1/addresses/{address}": CHAIN_DENOMINATED,
  "/v1/addresses/{address}/deployments/{skip}/{limit}": CHAIN_DENOMINATED,
  "/v1/addresses/{address}/transactions/{skip}/{limit}": CHAIN_DENOMINATED,
  "/v1/deployment/{owner}/{dseq}": CHAIN_DENOMINATED,
  "/v1/providers/{provider}/deployments/{skip}/{limit}": CHAIN_DENOMINATED,
  "/v1/provider-dashboard/{owner}": CHAIN_DENOMINATED,
  "/v1/provider-earnings/{owner}": CHAIN_DENOMINATED,
  "/v1/leases-duration/{owner}": CHAIN_DENOMINATED,
  "/v1/usage/history": CHAIN_DENOMINATED,
  "/v1/usage/history/stats": CHAIN_DENOMINATED,
  "/v1/dashboard-data": CHAIN_DENOMINATED,
  "/v1/bme/dashboard-data": CHAIN_DENOMINATED,
  "/v1/bme/status-history": CHAIN_DENOMINATED,
  "/v1/graph-data/{dataName}": CHAIN_DENOMINATED,
  "/v1/provider-graph-data/{dataName}": CHAIN_DENOMINATED,
  "/v1/market-data/{coin?}": CHAIN_DENOMINATED,
  "/v1/transactions": CHAIN_DENOMINATED,
  "/v1/transactions/{hash}": CHAIN_DENOMINATED,
  "/v1/blocks": CHAIN_DENOMINATED,
  "/v1/blocks/{height}": CHAIN_DENOMINATED,
  "/v1/predicted-block-date/{height}": CHAIN_DENOMINATED,
  "/v1/predicted-date-height/{timestamp}": CHAIN_DENOMINATED,
  "/v1/proposals": CHAIN_DENOMINATED,
  "/v1/proposals/{id}": CHAIN_DENOMINATED,
  "/v1/validators": CHAIN_DENOMINATED,
  "/v1/validators/{address}": CHAIN_DENOMINATED
};

const MAX_SUMMARY_LENGTH = 60;
const PATH_SEGMENT = "[A-Za-z0-9_~:@-][A-Za-z0-9._~:@-]*";
const UNTAGGED = "Other";

function escapedForRegExp(text: string): string {
  return text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

/** Path parameters match one plain segment, so a filled path cannot climb out of its route with dots, slashes or percent-encoding. */
function patternOf(template: string): RegExp {
  const source = template
    .split(/(\/\{[^}]+\})/)
    .map(part => {
      if (!part.startsWith("/{")) return escapedForRegExp(part);
      return part.endsWith("?}") ? `(?:/${PATH_SEGMENT})?` : `/${PATH_SEGMENT}`;
    })
    .join("");

  return new RegExp(`^${source}$`);
}

export function matchesRouteTemplate(template: string, path: string): boolean {
  return patternOf(template).test(path);
}

export function isDeniedConsoleApiPath(path: string): boolean {
  return Object.keys(DENIED_CONSOLE_API_ROUTES).some(template => matchesRouteTemplate(template, path));
}

function parameterCountOf(template: string): number {
  return template.split("{").length - 1;
}

/** Prefers the route with the fewest parameters, as a static path such as /v1/stripe/payment-methods/default beats a parameter in its place. */
export function matchConsoleApiRoute(routes: ConsoleApiRoute[], path: string): ConsoleApiRoute | null {
  const matches = routes.filter(route => matchesRouteTemplate(route.path, path));
  return matches.sort((left, right) => parameterCountOf(left.path) - parameterCountOf(right.path))[0] ?? null;
}

function summaryOf(operation: OperationObject): string {
  const sentence = (operation.summary || operation.description || "")
    .replace(/\s+/g, " ")
    .split(/\.(?:\s|$)/)[0]
    .trim();
  if (sentence.length <= MAX_SUMMARY_LENGTH) return sentence;

  const clause = sentence.split(/[,;(]/)[0].trim();
  return clause.length <= MAX_SUMMARY_LENGTH ? clause : sentence.slice(0, sentence.lastIndexOf(" ", MAX_SUMMARY_LENGTH));
}

function queryParametersOf(operation: OperationObject): string[] {
  return (operation.parameters ?? [])
    .filter((parameter): parameter is ParameterObject => "in" in parameter && parameter.in === "query")
    .map(({ name }) => name);
}

/** The GET routes of the published document, which already leaves out hidden and unpublished feature-flagged routes, minus the denied ones. */
export function consoleApiRoutesOf(document: OpenAPIObject): ConsoleApiRoute[] {
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) => {
    const operation: OperationObject | undefined = pathItem?.get;
    if (!operation || Object.hasOwn(DENIED_CONSOLE_API_ROUTES, path)) return [];

    return [
      {
        path,
        tag: operation.tags?.[0] ?? UNTAGGED,
        summary: summaryOf(operation),
        queryParameters: queryParametersOf(operation),
        forSignedInUser: !!operation.security?.length,
        responseSchema: operation.responses?.["200"]?.content?.["application/json"]?.schema
      }
    ];
  });
}

function catalogEntryOf({ path, queryParameters, summary }: ConsoleApiRoute): string {
  const query = queryParameters.length > 0 ? `?${queryParameters.join(",")}` : "";
  return summary ? `${path}${query} ${summary}` : `${path}${query}`;
}

/** One line per tag keeps the catalog small enough to ship in the tool description on every turn. */
export function consoleApiCatalogOf(routes: ConsoleApiRoute[]): string {
  return Object.entries(groupBy(routes, ({ tag }) => tag))
    .map(([tag, tagRoutes]) => `${tag}: ${tagRoutes.map(catalogEntryOf).join("; ")}`)
    .join("\n");
}
