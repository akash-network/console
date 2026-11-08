import { isSdlReference } from "@src/utils/sdl/sdlSecrets";

const KNOWN_ACRONYMS = new Set([
  "API",
  "URL",
  "URI",
  "ID",
  "HF",
  "GPU",
  "CPU",
  "DB",
  "UI",
  "JWT",
  "SSH",
  "AWS",
  "S3",
  "HTTP",
  "HTTPS",
  "TLS",
  "SMTP",
  "IP",
  "DNS",
  "LLM",
  "AI",
  "CORS",
  "OAUTH"
]);

const SECRET_VALUE_PREFIXES = ["sk-", "sk_live_", "sk_test_", "ghp_", "gho_", "github_pat_", "hf_", "xoxb-", "xoxp-", "glpat-", "AKIA", "AIza"];
const SECRET_KEY_PATTERN = /(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL)/i;
const BOOLEAN_PATTERN = /^(true|false)$/i;
const NUMBER_PATTERN = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const WORD_BOUNDARY_PATTERN = /([a-z])([A-Z])/g;
const WORD_SEPARATOR_PATTERN = /[_.-]/;

const MAX_LABEL_LENGTH = 80;
const MIN_PREFIXED_SECRET_LENGTH = 16;
const MIN_KEYED_SECRET_LENGTH = 8;
const MIN_RANDOM_SECRET_LENGTH = 24;
const MIN_RANDOM_SECRET_ENTROPY = 3.5;

export type AskedValueGuess =
  | { type: "secret"; required: true }
  | { type: "boolean"; default: "true" | "false"; required: false }
  | { type: "number"; default: string; integer: boolean; required: false }
  | { type: "text"; required: true }
  | { type: "text"; default: string; required: false };

export function labelFromKey(key: string): string {
  const words = key
    .replace(WORD_BOUNDARY_PATTERN, "$1_$2")
    .split(WORD_SEPARATOR_PATTERN)
    .filter(word => word !== "")
    .map((word, index) => {
      if (KNOWN_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      const lowerCased = word.toLowerCase();
      return index === 0 ? lowerCased.charAt(0).toUpperCase() + lowerCased.slice(1) : lowerCased;
    });

  return words.join(" ").slice(0, MAX_LABEL_LENGTH);
}

export function guessAskedValue(row: { value: string; isSecret: boolean }): AskedValueGuess {
  const { value } = row;
  if (row.isSecret) return { type: "secret", required: true };
  if (BOOLEAN_PATTERN.test(value)) return { type: "boolean", default: value.toLowerCase() as "true" | "false", required: false };
  if (NUMBER_PATTERN.test(value)) return { type: "number", default: value, integer: !value.includes("."), required: false };
  if (value === "") return { type: "text", required: true };
  return { type: "text", default: value, required: false };
}

export function looksLikeSecret(key: string, value: string): boolean {
  const candidate = value.trim();
  if (candidate === "" || /\s/.test(candidate) || isSdlReference(candidate)) return false;

  const hasKnownPrefix = SECRET_VALUE_PREFIXES.some(prefix => candidate.startsWith(prefix));
  if (hasKnownPrefix && candidate.length >= MIN_PREFIXED_SECRET_LENGTH) return true;
  if (SECRET_KEY_PATTERN.test(key) && candidate.length >= MIN_KEYED_SECRET_LENGTH) return true;
  return looksRandom(candidate);
}

function looksRandom(candidate: string): boolean {
  if (candidate.length < MIN_RANDOM_SECRET_LENGTH) return false;
  if (!/[A-Z]/.test(candidate) || !/[a-z]/.test(candidate) || !/\d/.test(candidate)) return false;
  return shannonEntropy(candidate) >= MIN_RANDOM_SECRET_ENTROPY;
}

function shannonEntropy(text: string): number {
  const characters = [...text];
  const counts = new Map<string, number>();
  for (const character of characters) counts.set(character, (counts.get(character) ?? 0) + 1);

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / characters.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
