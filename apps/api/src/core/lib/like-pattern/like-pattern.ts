/** A LIKE or ILIKE pattern matching values that contain the text, in which a `%`, `_` or `\` the caller typed matches only itself. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}
