export const REDACTED = "[REDACTED]";

/** Bounded on both sides of the secret word, since unbounded runs backtrack quadratically on long dotted words like `token.token.token`. */
const SECRET_KEY_NAME = String.raw`[\w.-]{0,64}?(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key|credentials?)[\w.-]{0,64}`;

/** A quote closing the key only counts before a quoted value, or an unquoted value could swallow the name of a second secret and leave its value visible. */
const SECRET_KEY_SEPARATOR = String.raw`(?:["']\s*[:=]\s*(?=["'])|\s*[:=]\s*)`;

/** Redacted to the end of its line, since the quote that really closes such a value cannot be told apart from a later value's opening quote. */
const QUOTED_SECRET_WITH_ESCAPED_QUOTE = new RegExp(String.raw`\b(${SECRET_KEY_NAME}${SECRET_KEY_SEPARATOR})(["'])(?:(?!\2)[^\n])*\\\2[^\n]*`, "gi");

const QUOTED_SECRET_VALUE = String.raw`(["'])(?:(?!\2)[^\n])+(\2)|(["'])(?:(?!\4)[^\n])+`;

/** Runs before the quoted-key rules, so whatever they match can only add to what it already redacted. */
const UNQUOTED_SECRET_KEY = new RegExp(String.raw`\b(${SECRET_KEY_NAME}\s*[:=]\s*)(?:${QUOTED_SECRET_VALUE}|[^\s"']+)`, "gi");

const QUOTED_SECRET_KEY_WITH_QUOTED_VALUE = new RegExp(String.raw`\b(${SECRET_KEY_NAME}["']\s*[:=]\s*)(?:${QUOTED_SECRET_VALUE})`, "gi");

/** Skips a value that is itself another key's assignment, which the rules before it have already redacted. */
const QUOTED_SECRET_KEY_WITH_UNQUOTED_VALUE = new RegExp(String.raw`\b(${SECRET_KEY_NAME}["']\s*[:=]\s*)(?![\w.-]*["']?\s*[:=])[^\s"',}\]]+`, "gi");

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

/** Tokens whose shape alone says a provider issued them, whatever names or carries them. */
const ISSUED_TOKEN_FORMATS = [
  /\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g,
  /\bsk-[\w-]{16,}/g,
  /\bhf_[A-Za-z0-9]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_\w{20,}/g,
  /\bxox[abprs]-[\w-]{10,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\bAIza[\w-]{35}/g,
  /\bglpat-[\w-]{20,}/g,
  /\bnpm_[A-Za-z0-9]{36}/g,
  /\bSG\.[\w-]{16,}\.[\w-]{16,}/g,
  /\b(?:r8|gsk)_[A-Za-z0-9]{20,}/g,
  /\bnvapi-[\w-]{20,}/g,
  /\bdckr_pat_[\w-]{20,}/g,
  /\btskey-[\w-]{20,}/g
];

const BEARER_TOKEN = /\b(bearer\s+)[\w.~+/-]+=*/gi;

const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi;

/** The token formats run last, so a token inside a named or carried value cannot cut that value's redaction short. */
const SECRET_REPLACEMENTS: [RegExp, string][] = [
  [PRIVATE_KEY_BLOCK, REDACTED],
  [BEARER_TOKEN, `$1${REDACTED}`],
  [URL_PASSWORD, `$1${REDACTED}@`],
  [QUOTED_SECRET_WITH_ESCAPED_QUOTE, `$1$2${REDACTED}`],
  [UNQUOTED_SECRET_KEY, `$1$2$4${REDACTED}$3`],
  [QUOTED_SECRET_KEY_WITH_QUOTED_VALUE, `$1$2$4${REDACTED}$3`],
  [QUOTED_SECRET_KEY_WITH_UNQUOTED_VALUE, `$1${REDACTED}`],
  ...ISSUED_TOKEN_FORMATS.map((format): [RegExp, string] => [format, REDACTED])
];

/** Best effort over common credential shapes, applied to every free text the team may later read, whatever the user consented to. */
export function redactSecrets(text: string): string {
  return SECRET_REPLACEMENTS.reduce((redacted, [pattern, replacement]) => redacted.replace(pattern, replacement), text);
}

/** Narrower than `redactSecrets` on purpose: no rule depends on what a value is called, so text that only mentions a token does not match. */
export function findIssuedTokenOffsets(text: string): number[] {
  return ISSUED_TOKEN_FORMATS.flatMap(format => [...text.matchAll(format)].map(match => match.index));
}

export function holdsIssuedCredential(text: string): boolean {
  return text.search(PRIVATE_KEY_BLOCK) !== -1 || findIssuedTokenOffsets(text).length > 0;
}

export function holdsUrlPassword(text: string): boolean {
  return text.search(URL_PASSWORD) !== -1;
}

export function redactSecretStrings<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map(redactSecretStrings) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactSecretStrings(nested)])) as T;
  }

  return value;
}

/** Bounded like an address can be, so a long run of word characters without an @ cannot backtrack quadratically. */
const EMAIL_ADDRESS = /\b[\w.%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,8}[A-Za-z]{2,24}\b/g;

/** Kept apart from `redactSecrets`, which counts what it takes out of the user's own message and tells them a secret was removed. */
export function redactEmailAddresses(text: string): string {
  return text.replace(EMAIL_ADDRESS, REDACTED);
}

/** How many secrets `redactSecrets` took out of a text, from its output, so a caller can tell the user without the value or its kind leaving the API. */
export function countRedactions(original: string, redacted: string): number {
  return occurrencesOfRedacted(redacted) - occurrencesOfRedacted(original);
}

function occurrencesOfRedacted(text: string): number {
  return text.split(REDACTED).length - 1;
}
