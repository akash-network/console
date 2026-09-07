/** An Ignore plugin rather than `// Stryker disable` comments, so no source file has to carry an annotation for the gate's benefit. */
const IGNORE_REASON = "Ignored because it sits inside an observability call, whose arguments no unit test asserts on";

const LOG_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal", "verbose", "log"]);
const LOGGER_WORDS = new Set(["log", "logger", "logging", "console"]);
const CALL_NODES = new Set(["CallExpression", "OptionalCallExpression"]);
const MEMBER_NODES = new Set(["MemberExpression", "OptionalMemberExpression"]);

export const strykerPlugins = [{ kind: "Ignore", name: "observability", value: { shouldIgnore } }];

/** Stryker enters every node and ignoring one ignores its whole subtree, so judging the call itself covers its arguments. */
function shouldIgnore(path) {
  return isObservabilityCall(path.node) ? IGNORE_REASON : undefined;
}

function isObservabilityCall(node) {
  if (!CALL_NODES.has(node.type) || !MEMBER_NODES.has(node.callee.type)) return false;

  return LOG_LEVELS.has(propertyName(node.callee)) && namesALogger(receiverName(node.callee.object));
}

function propertyName({ property, computed }) {
  if (property.type === "StringLiteral") return property.value;

  return !computed && property.type === "Identifier" ? property.name : "";
}

function receiverName(object) {
  if (object.type === "Identifier") return object.name;

  return MEMBER_NODES.has(object.type) ? propertyName(object) : "";
}

/** A whole word has to name the logger: `Math.log(x)` and a `catalog.error(...)` are calls whose arguments a test does assert on. */
function namesALogger(name) {
  return name.split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/).some(word => LOGGER_WORDS.has(word.toLowerCase()));
}
