import { EnglishMnemonic } from "@cosmjs/crypto";

import { isSdlReference } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { findIssuedTokenOffsets, holdsUrlPassword } from "@src/feedback/lib/redact-secrets/redact-secrets";

export type CredentialSign = "known_format" | "credential_name" | "credential_assignment" | "random_string";

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
const MNEMONIC_WORDS = new Set(EnglishMnemonic.wordlist);
const MIN_MNEMONIC_WORDS = 12;
const PRIVATE_KEY_HEADER = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const BEARER_TOKEN = /\bbearer\s+([\w.~+/-]+=*)/i;
/** The name is bounded, since an unbounded run backtracks quadratically over long dotted words that never reach an assignment. */
const ASSIGNMENTS_INSIDE_A_VALUE = /["']?([A-Za-z][\w.-]{0,63})["']?\s*[:=](?!\/\/)\s*["']?([^\s"',}\]]+)/g;

/** Answers why a value reads as a key, token or password, without ever reporting the value itself. */
export function findCredentialSign(value: string, variableName?: string): CredentialSign | undefined {
  const trimmed = value.trim();

  if (!trimmed || isSdlReference(trimmed)) return undefined;
  if (holdsKnownFormat(trimmed)) return "known_format";
  if (!isRealValue(trimmed)) return undefined;
  if (variableName && isCredentialName(variableName, trimmed)) return "credential_name";
  if (holdsRandomString(trimmed)) return "random_string";
  if (assignsCredential(trimmed)) return "credential_assignment";

  return undefined;
}

/** Where each credential in a known format starts; narrower than the checks on a variable, since free text carries no name to judge and often mentions tokens without holding one. */
export function findKnownCredentialOffsets(text: string): number[] {
  return [...findIssuedTokenOffsets(text), ...[...text.matchAll(PRIVATE_KEY_HEADER)].map(match => match.index), ...findMnemonicOffsets(text)];
}

export function holdsKnownCredentialFormat(text: string): boolean {
  return findKnownCredentialOffsets(text).length > 0;
}

function isRealValue(value: string): boolean {
  return !!value && !NOT_A_VALUE.test(value) && !PLACEHOLDER.test(value) && !isSdlReference(value);
}

function holdsKnownFormat(value: string): boolean {
  return holdsKnownCredentialFormat(value) || holdsUrlPassword(value) || isOpaque(value.match(BEARER_TOKEN)?.[1] ?? "");
}

/** Arguments and inline config set values under their own names, such as `--api-key=…` inside a variable that is itself named for something else. */
function assignsCredential(value: string): boolean {
  return [...value.matchAll(ASSIGNMENTS_INSIDE_A_VALUE)].some(([, name, assigned]) => isRealValue(assigned) && isCredentialName(name, assigned));
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

const LIST_MARKER = /^(?:\d+[.):]?|[-*])$/;

const QUOTED_OR_LISTED_WORD = /^["'`]*([a-z]+)["'`,;]*$/;

/** A run of mnemonic words is found wherever it sits, however its lines break and whether it is quoted, numbered or listed, since ordinary prose never strings twelve of them together. */
function findMnemonicOffsets(text: string): number[] {
  const offsets: number[] = [];
  let runStart = 0;
  let runLength = 0;

  for (const token of text.matchAll(/\S+/g)) {
    if (LIST_MARKER.test(token[0])) continue;

    if (!MNEMONIC_WORDS.has(token[0].match(QUOTED_OR_LISTED_WORD)?.[1] ?? "")) {
      runLength = 0;
      continue;
    }

    if (runLength === 0) runStart = token.index;
    runLength++;
    if (runLength === MIN_MNEMONIC_WORDS) offsets.push(runStart);
  }

  return offsets;
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
