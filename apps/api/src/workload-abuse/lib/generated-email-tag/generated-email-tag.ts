/** Letters-only tags stay out on purpose, since real people tag with words such as `+newsletter`. */
const MIN_GENERATED_TAG_LENGTH = 8;

const ALPHANUMERIC = /^[a-z0-9]+$/i;
const LETTER = /[a-z]/i;
const DIGIT = /\d/;

export function hasGeneratedPlusTag(email: string | null | undefined): boolean {
  const tag = extractPlusTag(email);
  if (!tag || tag.length < MIN_GENERATED_TAG_LENGTH) return false;

  return ALPHANUMERIC.test(tag) && LETTER.test(tag) && DIGIT.test(tag);
}

function extractPlusTag(email: string | null | undefined): string | null {
  if (!email) return null;

  const separatorIndex = email.lastIndexOf("@");
  if (separatorIndex === -1) return null;

  const localPart = email.slice(0, separatorIndex);
  const tagStart = localPart.indexOf("+");

  return tagStart === -1 ? null : localPart.slice(tagStart + 1);
}
