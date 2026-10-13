import { randomBytes } from "node:crypto";

const MAX_SLUG_LENGTH = 40;

export const MAX_NUMBERED_SLUG_SUFFIX = 10;

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function slugCandidates(value: string, fallbackPrefix: string, randomSuffix: () => string = createRandomSuffix): string[] {
  const base = toSlug(value) || withSuffix(fallbackPrefix, randomSuffix());
  const numbered = Array.from({ length: MAX_NUMBERED_SLUG_SUFFIX - 1 }, (_, index) => withSuffix(base, String(index + 2)));

  return [base, ...numbered, withSuffix(base, randomSuffix())];
}

function withSuffix(base: string, suffix: string): string {
  return `${base.slice(0, MAX_SLUG_LENGTH - suffix.length - 1).replace(/-+$/, "")}-${suffix}`;
}

function createRandomSuffix(): string {
  return randomBytes(4).toString("hex");
}
