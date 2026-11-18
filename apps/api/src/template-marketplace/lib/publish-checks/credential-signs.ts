import { isSdlReference } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";

export type CredentialSign = "known_format" | "credential_name" | "random_string";

const NOT_A_VALUE = /^(?:true|false|yes|no|on|off|enabled|disabled|none|null|nil|undefined|-?\d+(?:\.\d+)?)$/i;

const PLACEHOLDER = /^(?:<[^>]*>|\$\{?\w+\}?|x{3,}|\*{3,}|change[-_ ]?me|replace[-_ ]?me|your[-_ ].*|todo|tbd|example|placeholder)$/i;

const NAME_SEGMENT_BOUNDARY = /[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/;

/** A variable named after one of these describes a credential rather than holding one. */
const DESCRIBING_LAST_SEGMENTS = new Set([
  "HEADER",
  "FILE",
  "PATH",
  "DIR",
  "URL",
  "URI",
  "NAME",
  "ID",
  "LENGTH",
  "SIZE",
  "LIMIT",
  "BUDGET",
  "COUNT",
  "TTL",
  "EXPIRY",
  "EXPIRES",
  "EXPIRATION",
  "SECONDS",
  "MINUTES",
  "HOURS",
  "DAYS",
  "TYPE",
  "ALGORITHM",
  "ALGO",
  "PREFIX",
  "FIELD",
  "PARAM",
  "ENABLED",
  "REQUIRED"
]);

const CREDENTIAL_SEGMENTS = new Set([
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PASSWD",
  "PWD",
  "PASSPHRASE",
  "APIKEY",
  "PRIVATEKEY",
  "SECRETKEY",
  "ACCESSKEY",
  "CREDENTIAL",
  "CREDENTIALS",
  "MNEMONIC"
]);

const KEY_QUALIFIERS = new Set(["API", "ACCESS", "PRIVATE", "SECRET", "AUTH", "ENCRYPTION", "SIGNING", "MASTER", "LICENSE"]);

/** Names that hold a credential only some of the time, so their value must also look opaque. */
const AMBIGUOUS_LAST_SEGMENTS = new Set(["KEY", "SALT", "SEED", "PASS", "AUTH"]);

const MIN_OPAQUE_LENGTH = 12;
const MIN_RANDOM_RUN_LENGTH = 24;
const MIN_RANDOM_RUN_ENTROPY_BITS = 3.5;
const ALPHANUMERIC_RUNS = /[A-Za-z0-9]+/g;
const HEX_ONLY = /^(?:0x)?[0-9a-fA-F]+$/;
const MNEMONIC_WORD = /^[a-z]{3,8}$/;
const MNEMONIC_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);

/** Answers why a value reads as a key, token or password, without ever reporting the value itself. */
export function findCredentialSign(value: string, variableName?: string): CredentialSign | undefined {
  const trimmed = value.trim();

  if (!trimmed || NOT_A_VALUE.test(trimmed) || PLACEHOLDER.test(trimmed) || isSdlReference(trimmed)) return undefined;
  if (redactSecrets(trimmed) !== trimmed || isMnemonic(trimmed)) return "known_format";
  if (variableName && isCredentialName(variableName, trimmed)) return "credential_name";
  if (holdsRandomString(trimmed)) return "random_string";

  return undefined;
}

function isCredentialName(name: string, value: string): boolean {
  const segments = name
    .split(NAME_SEGMENT_BOUNDARY)
    .filter(Boolean)
    .map(segment => segment.toUpperCase());
  const last = segments.at(-1) ?? "";

  if (DESCRIBING_LAST_SEGMENTS.has(last)) return false;
  if (segments.some((segment, index) => CREDENTIAL_SEGMENTS.has(segment) || (segment === "KEY" && KEY_QUALIFIERS.has(segments[index - 1])))) return true;

  return AMBIGUOUS_LAST_SEGMENTS.has(last) && isOpaque(value);
}

function isOpaque(value: string): boolean {
  return value.length >= MIN_OPAQUE_LENGTH && !/\s/.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function isMnemonic(value: string): boolean {
  const words = value.split(/\s+/);

  return MNEMONIC_WORD_COUNTS.has(words.length) && words.every(word => MNEMONIC_WORD.test(word));
}

/** Hex is left to the name rule, since digests, commits and addresses are ordinary config; mixed-case runs this long are almost never words. */
function holdsRandomString(value: string): boolean {
  return (value.match(ALPHANUMERIC_RUNS) ?? []).some(
    run =>
      run.length >= MIN_RANDOM_RUN_LENGTH &&
      !HEX_ONLY.test(run) &&
      /[a-z]/.test(run) &&
      /[A-Z]/.test(run) &&
      /\d/.test(run) &&
      shannonEntropyBits(run) >= MIN_RANDOM_RUN_ENTROPY_BITS
  );
}

function shannonEntropyBits(text: string): number {
  const counts = new Map<string, number>();
  for (const character of text) counts.set(character, (counts.get(character) ?? 0) + 1);

  return [...counts.values()].reduce((bits, count) => bits - (count / text.length) * Math.log2(count / text.length), 0);
}
