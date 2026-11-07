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

/** The only GET routes the assistant reads, so a route added to the API stays unreadable until it is reviewed and listed here. */
export const ASSISTANT_READABLE_ROUTES: ReadonlySet<string> = new Set([
  "/v1/deployments",
  "/v1/deployments/{dseq}/info",
  "/v1/deployment-names",
  "/v1/deployment-locations/{dseq}",
  "/v1/spend-rate",
  "/v1/weekly-cost",
  "/v1/leases",
  "/v1/bids",
  "/v1/bids/{dseq}",
  "/v1/activities",
  "/v1/activities/{id}",
  "/v1/hardware-requests",
  "/v1/hardware-requests/{id}/offers",
  "/v1/organizations",
  "/v1/projects",
  "/v1/projects/{id}",
  "/v1/project-budgets",
  "/v1/project-spend",
  "/v1/deployment-spend",
  "/v1/favorite-providers",
  "/v1/user/favoriteTemplates",
  "/v1/wallet-balances",
  "/v1/deployment-alerts/{dseq}",
  "/v1/stripe/first-purchase-bonus",
  "/v1/gpu",
  "/v1/gpu-breakdown",
  "/v1/gpu-models",
  "/v1/gpu-prices",
  "/v1/trial-gpu-availability",
  "/v1/network-capacity",
  "/v1/providers",
  "/v1/providers/{address}",
  "/v1/provider-search",
  "/v1/provider-regions",
  "/v1/provider-locations",
  "/v1/provider-versions",
  "/v1/provider-attributes-schema",
  "/v1/auditors",
  "/v1/providers/{providerAddress}/active-leases-graph-data",
  "/v1/placement-options",
  "/v1/templates-list",
  "/v1/templates/{id}",
  "/v1/blockchain-status",
  "/v1/deployment-funding-config"
]);

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

export function isAssistantReadablePath(path: string): boolean {
  return [...ASSISTANT_READABLE_ROUTES].some(template => matchesRouteTemplate(template, path));
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

/** Matches every published GET route first, so a parameter of a listed route cannot stand in for a static route that is not listed. */
export function readableConsoleApiRouteOf(publishedRoutes: ConsoleApiRoute[], path: string): ConsoleApiRoute | null {
  const route = matchConsoleApiRoute(publishedRoutes, path);
  return route && ASSISTANT_READABLE_ROUTES.has(route.path) ? route : null;
}

/** Every GET route of the published document, which already leaves out hidden and unpublished feature-flagged routes. */
export function publishedGetRoutesOf(document: OpenAPIObject): ConsoleApiRoute[] {
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) => {
    const operation: OperationObject | undefined = pathItem?.get;
    if (!operation) return [];

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

export function consoleApiRoutesOf(document: OpenAPIObject): ConsoleApiRoute[] {
  return publishedGetRoutesOf(document).filter(({ path }) => ASSISTANT_READABLE_ROUTES.has(path));
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
