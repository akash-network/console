const LINE_BREAKS_AND_TABS = /[\t\n\v\f\r\u0085\u2028\u2029]+/;

/** The api refuses line breaks and tabs in single-line fields, so text typed over several lines is sent as one, trimmed at both ends. */
export function toSingleLine(text: string): string {
  return text
    .split(LINE_BREAKS_AND_TABS)
    .map(line => line.trim())
    .filter(Boolean)
    .join(" ");
}
