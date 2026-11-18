const LINE_BREAKS_AND_TABS_WITH_SURROUNDING_SPACE = /\s*[\t\n\v\f\r\u0085\u2028\u2029]+\s*/g;

/** The api refuses line breaks and tabs in single-line fields, so an editor that wraps text still has to send one line. */
export function toSingleLine(text: string): string {
  return text.replace(LINE_BREAKS_AND_TABS_WITH_SURROUNDING_SPACE, " ");
}
