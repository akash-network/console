const BIGINT_SENTINEL = "__BIGINT__";
const BIGINT_PATTERN = new RegExp(`"${BIGINT_SENTINEL}(-?\\d+)"`, "g");

/**
 * Preserves bigint values by serializing them as strings with a unique sentinel prefix
 * and then replacing them with unquoted values in the final JSON string.
 */
export function serializeJsonb(value: unknown): string {
  const json = JSON.stringify(value, (_key, val) => {
    if (typeof val === "bigint") return `${BIGINT_SENTINEL}${val}`;
    return val;
  });
  return json.replace(BIGINT_PATTERN, "$1");
}

type ReviverWithContext = (key: string, value: unknown, context: { source: string }) => unknown;

const parseJSON = JSON.parse as (text: string, reviver?: ReviverWithContext) => unknown;
export function parseJsonb(text: string): unknown {
  return parseJSON(text, (_, value, context) => {
    if (typeof value === "number" && context?.source !== undefined && /^-?\d+$/.test(context.source) && String(value) !== context.source) {
      return BigInt(context.source);
    }
    return value;
  });
}
