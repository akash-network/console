const CAMEL_CASE_IDENTIFIER = /^[a-z][a-zA-Z]*$/;
const DISABLE_HINT =
  "Extend additionalVerbs in the rule config (packages/dev-config/.eslintrc.base.js) when you need a new domain verb, or add // eslint-disable-next-line akash/operation-id-format for a one-off.";

const methodVerbsSchema = {
  type: "object",
  properties: {
    collection: { type: "array", items: { type: "string" } },
    single: { type: "array", items: { type: "string" } }
  },
  additionalProperties: false
};

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce createRoute operationId follows <verb><Resource> convention and matches the route's HTTP method and path (collection vs single-resource)."
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalVerbs: {
            type: "object",
            properties: {
              get: methodVerbsSchema,
              post: methodVerbsSchema,
              put: methodVerbsSchema,
              patch: methodVerbsSchema,
              delete: methodVerbsSchema
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const additionalVerbs = context.options[0]?.additionalVerbs ?? {};
    return {
      CallExpression(node) {
        if (!isCreateRouteCall(node)) return;
        const routeConfig = node.arguments[0];

        const operationIdProperty = findObjectProperty(routeConfig, "operationId");
        if (!operationIdProperty) return;

        if (operationIdProperty.value.type !== "Literal" || typeof operationIdProperty.value.value !== "string") {
          context.report({ node: operationIdProperty.value, message: "operationId must be a string literal." });
          return;
        }

        const operationId = operationIdProperty.value.value;

        if (!CAMEL_CASE_IDENTIFIER.test(operationId)) {
          context.report({
            node: operationIdProperty.value,
            message: `operationId "${operationId}" must be camelCase (start with a lowercase letter, alphanumeric only).`
          });
          return;
        }

        const method = getStringLiteralValue(findObjectProperty(routeConfig, "method"))?.toLowerCase();
        const path = getStringLiteralValue(findObjectProperty(routeConfig, "path"));
        if (!method || !path) return;

        const isSingleResource = isSingleResourcePath(path);
        const expectedVerbs = getExpectedVerbs(method, isSingleResource, additionalVerbs);
        if (!expectedVerbs) return;

        const actualVerb = extractLeadingVerb(operationId);
        if (expectedVerbs.includes(actualVerb)) return;

        context.report({
          node: operationIdProperty.value,
          message: `${method.toUpperCase()} ${path}: operationId "${operationId}" starts with "${actualVerb}", but ${method.toUpperCase()} on a ${describeRouteShape(isSingleResource)} expects ${formatVerbList(expectedVerbs)}. ${DISABLE_HINT}`
        });
      }
    };
  }
};

/**
 * Tests whether an AST CallExpression node is a `createRoute({...})` invocation
 * with an object literal as its first argument.
 * @param {object} node - ESTree CallExpression node.
 * @returns {boolean}
 */
function isCreateRouteCall(node) {
  return node.callee.type === "Identifier" && node.callee.name === "createRoute" && node.arguments[0]?.type === "ObjectExpression";
}

/**
 * Looks up a property on an object literal AST node by name. Matches both
 * identifier keys (`name: ...`) and string-literal keys (`"name": ...`).
 * Computed and spread keys are ignored.
 * @param {object} objectExpression - ESTree ObjectExpression node.
 * @param {string} name
 * @returns {object | undefined} The matching ESTree Property, or undefined.
 */
function findObjectProperty(objectExpression, name) {
  return objectExpression.properties.find(
    p => p.type === "Property" && !p.computed && ((p.key.type === "Identifier" && p.key.name === name) || (p.key.type === "Literal" && p.key.value === name))
  );
}

/**
 * Returns the string value of a property whose value is a string literal.
 * Returns null for missing properties, non-literals, or non-string literals —
 * the caller decides whether the absence is an error.
 * @param {object | undefined} property - ESTree Property node, or undefined.
 * @returns {string | null}
 */
function getStringLiteralValue(property) {
  if (!property || property.value.type !== "Literal" || typeof property.value.value !== "string") {
    return null;
  }
  return property.value.value;
}

/**
 * Returns true when an OpenAPI path targets a single resource — i.e. it ends
 * with a path parameter like "/foo/{id}". A trailing slash after the parameter
 * is tolerated.
 * @param {string} path
 * @returns {boolean}
 */
function isSingleResourcePath(path) {
  return path.endsWith("}") || path.endsWith("}/");
}

const EXPECTED_VERBS_BY_METHOD = {
  get: { collection: ["list"], single: ["get"] },
  post: { collection: ["create"], single: ["create", "upsert"] },
  put: { collection: ["update"], single: ["update"] },
  patch: { collection: ["update"], single: ["update"] },
  delete: { collection: ["delete"], single: ["delete"] }
};

/**
 * Returns the verbs allowed to start an operationId for a given HTTP method
 * and route shape, merging built-in CRUD verbs with `additionalVerbs` from the
 * rule's options. Returns null for unknown methods, signalling the rule to
 * skip semantic validation for that call.
 * @param {string} method - Lowercase HTTP method (e.g. "get", "post").
 * @param {boolean} isSingleResource - True if the route path ends with "{id}".
 * @param {Record<string, { collection?: string[], single?: string[] }>} additionalVerbs
 * @returns {string[] | null}
 */
function getExpectedVerbs(method, isSingleResource, additionalVerbs) {
  const expectations = EXPECTED_VERBS_BY_METHOD[method];
  if (!expectations) return null;
  const shape = isSingleResource ? "single" : "collection";
  const extra = additionalVerbs[method]?.[shape] ?? [];
  return [...expectations[shape], ...extra];
}

const LEADING_LOWERCASE_WORD = /^[a-z]+/;

/**
 * Extracts the leading lowercase verb segment from a camelCase operationId,
 * e.g. "listApiKeys" → "list", "upsertDeploymentAlert" → "upsert".
 * Assumes the input has already been validated as a camelCase identifier.
 * @param {string} operationId
 * @returns {string}
 */
function extractLeadingVerb(operationId) {
  return operationId.match(LEADING_LOWERCASE_WORD)[0];
}

/**
 * Returns a human-readable description of the route's shape, used in error
 * messages to explain why a verb is expected.
 * @param {boolean} isSingleResource
 * @returns {string}
 */
function describeRouteShape(isSingleResource) {
  return isSingleResource ? "single resource (path ends with {id})" : "collection (no trailing {id})";
}

/**
 * Formats a list of expected verbs for an error message, e.g.
 * ["create", "upsert"] → '"create" or "upsert"'.
 * @param {string[]} verbs
 * @returns {string}
 */
function formatVerbList(verbs) {
  return verbs.map(v => `"${v}"`).join(" or ");
}
