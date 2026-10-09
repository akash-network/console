export type CommandScope = "actions" | "deployments" | "pages";

export type ScopePrefix = ">" | "@" | "/";

export const SCOPE_BY_PREFIX: Record<ScopePrefix, CommandScope> = { ">": "actions", "@": "deployments", "/": "pages" };

const SCOPE_CYCLE: Array<ScopePrefix | null> = [null, ">", "@", "/"];

const WORD_BREAK = /[\s\-_/.:]/;

const KEYWORD_WEIGHT = 0.6;

const META_WEIGHT = 0.4;

const MAX_MATCHES_PER_SECTION = 6;

const MAX_ITEMS_PER_SECTION = 50;

export interface ParsedQuery {
  prefix: ScopePrefix | null;
  scope: CommandScope | null;
  query: string;
}

export interface SearchableItem {
  id: string;
  label: string;
  keywords?: string;
  meta?: string;
}

export interface CommandSection<T extends SearchableItem> {
  key: CommandScope;
  label: string;
  items: T[];
  emptyQueryLimit?: number;
}

export function parseQuery(input: string): ParsedQuery {
  const prefix = readPrefix(input);

  return { prefix, scope: prefix ? SCOPE_BY_PREFIX[prefix] : null, query: withoutPrefix(input).trim().toLowerCase() };
}

export function applyScope(input: string, prefix: ScopePrefix | null): string {
  const typed = withoutPrefix(input).trimStart();

  return prefix ? `${prefix} ${typed}` : typed;
}

export function cycleScope(input: string, direction: 1 | -1): string {
  const current = SCOPE_CYCLE.indexOf(readPrefix(input));

  return applyScope(input, SCOPE_CYCLE[(current + direction + SCOPE_CYCLE.length) % SCOPE_CYCLE.length]);
}

/** Labels also match on word initials ("nd") and nearly contiguous letters ("tmpl"); keywords and meta only on substrings. */
export function scoreText(text: string | undefined, query: string, isLoose = false): number {
  const haystack = (text ?? "").toLowerCase();
  if (!query) return 0;

  const index = haystack.indexOf(query);
  if (index > 0) return (WORD_BREAK.test(haystack[index - 1]) ? 80 : 50) - Math.min(index, 20) * 0.1;
  if (index === 0) return 100;
  if (!isLoose) return 0;
  if (matchesWordInitials(haystack, query)) return 45;

  const skipped = countSkippedCharacters(haystack, query);
  return skipped <= 3 ? 35 - skipped * 3 : 0;
}

export function scoreItem(item: SearchableItem, query: string): number {
  return Math.max(scoreText(item.label, query, true), scoreText(item.keywords, query) * KEYWORD_WEIGHT, scoreText(item.meta, query) * META_WEIGHT);
}

/** With a query, the section holding the strongest match comes first so Enter on the first row always runs the best match. */
export function rankSections<T extends SearchableItem>(sections: CommandSection<T>[], { scope, query }: ParsedQuery): CommandSection<T>[] {
  const visible = sections.filter(section => !scope || section.key === scope);

  if (!query) {
    return visible
      .map(section => ({ ...section, items: section.items.slice(0, scope ? MAX_ITEMS_PER_SECTION : section.emptyQueryLimit ?? MAX_ITEMS_PER_SECTION) }))
      .filter(section => section.items.length > 0);
  }

  const limit = scope ? MAX_ITEMS_PER_SECTION : MAX_MATCHES_PER_SECTION;

  return visible
    .map(section => ({ section, matches: matchItems(section.items, query) }))
    .filter(({ matches }) => matches.length > 0)
    .sort((a, b) => b.matches[0].score - a.matches[0].score)
    .map(({ section, matches }) => ({ ...section, items: matches.slice(0, limit).map(({ item }) => item) }));
}

function matchItems<T extends SearchableItem>(items: T[], query: string) {
  return items
    .map(item => ({ item, score: scoreItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}

function readPrefix(input: string): ScopePrefix | null {
  const first = input.charAt(0);

  return isScopePrefix(first) ? first : null;
}

function isScopePrefix(value: string): value is ScopePrefix {
  return value in SCOPE_BY_PREFIX;
}

function withoutPrefix(input: string) {
  return readPrefix(input) ? input.slice(1) : input;
}

function matchesWordInitials(text: string, query: string) {
  let position = -1;

  for (const char of query) {
    if (text[position + 1] === char) {
      position += 1;
      continue;
    }

    let next = position + 1;
    while (next < text.length && !(text[next] === char && WORD_BREAK.test(text[next - 1]))) next++;
    if (next >= text.length) return false;
    position = next;
  }

  return true;
}

function countSkippedCharacters(text: string, query: string) {
  let from = 0;
  let skipped = 0;

  for (const char of query) {
    const index = text.indexOf(char, from);
    if (index < 0) return Infinity;
    skipped += index - from;
    from = index + 1;
  }

  return skipped;
}
