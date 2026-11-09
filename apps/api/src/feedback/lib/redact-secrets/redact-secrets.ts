export const REDACTED = "[REDACTED]";

/** Bounded on both sides of the secret word, since unbounded runs backtrack quadratically on long dotted words like `token.token.token`. */
const SECRET_KEY_NAME = String.raw`[\w.-]{0,64}?(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key|credentials?)[\w.-]{0,64}`;

const SECRET_REPLACEMENTS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
  [/\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g, REDACTED],
  [/\bsk-[\w-]{16,}/g, REDACTED],
  [/\bhf_[A-Za-z0-9]{20,}/g, REDACTED],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, REDACTED],
  [/\bgithub_pat_\w{20,}/g, REDACTED],
  [/\bxox[abprs]-[\w-]{10,}/g, REDACTED],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, REDACTED],
  [/\b(bearer\s+)[\w.~+/-]+=*/gi, `$1${REDACTED}`],
  [/\b([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/gi, `$1${REDACTED}@`],
  [new RegExp(String.raw`\b(${SECRET_KEY_NAME}\s*[:=]\s*)(?:(["'])(?:(?!\2)[^\n])+\2|[^\s"']+)`, "gi"), `$1$2${REDACTED}$2`]
];

/** Best effort over common credential shapes, applied to every free text the team may later read, whatever the user consented to. */
export function redactSecrets(text: string): string {
  return SECRET_REPLACEMENTS.reduce((redacted, [pattern, replacement]) => redacted.replace(pattern, replacement), text);
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
