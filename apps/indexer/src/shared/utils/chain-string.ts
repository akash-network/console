/** The length of the indexer's string columns created without an explicit type, which Sequelize maps to varchar(255). */
export const MAX_VARCHAR_LENGTH = 255;

const LONE_SURROGATE = /\p{Cs}/gu;

/** Postgres refuses NUL in any text value, and one refused value rolls back the whole block group, so the sync would stop on that block. */
export function toStorableText(value: string): string;
export function toStorableText(value: string | undefined): string | undefined;
export function toStorableText(value: string | undefined): string | undefined {
  return value?.replaceAll("\0", "").replace(LONE_SURROGATE, "");
}

/** The chain bounds the length of none of these values, while a varchar(255) column refuses anything longer. */
export function toStorableVarchar(value: string): string;
export function toStorableVarchar(value: string | undefined): string | undefined;
export function toStorableVarchar(value: string | undefined): string | undefined {
  const text = toStorableText(value);

  return text === undefined ? undefined : Array.from(text).slice(0, MAX_VARCHAR_LENGTH).join("");
}
