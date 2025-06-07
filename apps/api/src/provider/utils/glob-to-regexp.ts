const GLOB_TO_REGEX = {
  "*": "[^/]+",
  "?": "."
};

/**
 * This function converts a glob pattern to a regular expression.
 * It escapes special characters and replaces `*` and `?` with their corresponding regular expression patterns.
 */
export function globToRegExp(pattern: string): string {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const converted = escaped.replaceAll("?", GLOB_TO_REGEX["?"]).replace(/\*+/g, GLOB_TO_REGEX["*"]);

  return `^${converted}$`;
}

const GLOB_PATTERNS = Object.keys(GLOB_TO_REGEX);
export function includesGlobPattern(pattern: string): boolean {
  return GLOB_PATTERNS.some(globPattern => pattern.includes(globPattern));
}
