const HOOK_NAME = /^use[A-Z0-9]/;
const COMPONENT_NAME = /^[A-Z]/;
const GUIDANCE =
  "The DEPENDENCIES map may only contain React components (PascalCase) or hooks (use-prefixed). Inject services via the useServices hook instead.";

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that the injectable `const DEPENDENCIES` map in React components contains only React components (PascalCase) or hooks (use-prefixed)."
    },
    schema: []
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (!isDependenciesMap(node)) return;

        for (const property of node.init.properties) {
          if (property.type === "SpreadElement") {
            context.report({
              node: property,
              message: `Spread elements are not allowed in the DEPENDENCIES map. List each React component or hook explicitly. ${GUIDANCE}`
            });
            continue;
          }

          const name = getPropertyName(property);
          if (name === null || isReactComponentOrHook(name)) continue;

          context.report({
            node: property,
            message: `"${name}" is not a React component or hook. ${GUIDANCE}`
          });
        }
      }
    };
  }
};

/**
 * Tests whether a VariableDeclarator is `const DEPENDENCIES = { ... }` — the
 * injectable dependency map React components in this repo expose for testing.
 * @param {object} node - ESTree VariableDeclarator node.
 * @returns {boolean}
 */
function isDependenciesMap(node) {
  return node.id.type === "Identifier" && node.id.name === "DEPENDENCIES" && node.init?.type === "ObjectExpression";
}

/**
 * Returns the local name a DEPENDENCIES entry is exposed under (identifier or
 * string-literal key), which is how it is later referenced as `d.<name>`.
 * Returns null for computed or otherwise unnamed keys, which the rule skips.
 * @param {object} property - ESTree Property node.
 * @returns {string | null}
 */
function getPropertyName(property) {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal" && typeof property.key.value === "string") return property.key.value;
  return null;
}

/**
 * A name denotes a React component when it is PascalCase and a React hook when
 * it is `use`-prefixed followed by an uppercase letter or digit — the same
 * naming contract React itself relies on to tell components and hooks apart.
 * @param {string} name
 * @returns {boolean}
 */
function isReactComponentOrHook(name) {
  return COMPONENT_NAME.test(name) || HOOK_NAME.test(name);
}
