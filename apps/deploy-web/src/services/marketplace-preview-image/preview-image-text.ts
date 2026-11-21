type CodePointRange = readonly [first: number, last: number];

/** Only characters the fonts shipped with the app can draw: for any other one the image renderer would fetch a font or an emoji from a third party. */
const RENDERABLE_RANGES: readonly CodePointRange[] = [
  [0x20, 0x7e],
  [0xa1, 0xa8],
  [0xaa, 0xac],
  [0xaf, 0xff],
  [0x100, 0x113],
  [0x116, 0x12b],
  [0x12e, 0x137],
  [0x139, 0x13e],
  [0x141, 0x148],
  [0x14a, 0x14d],
  [0x150, 0x17e],
  [0x400, 0x40c],
  [0x40e, 0x45f],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2026, 0x2026]
];

const ELLIPSIS = "…";
const WHITESPACE = /\s/u;

export function isRenderableCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return RENDERABLE_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last);
}

export function listRenderableCharacters(): string[] {
  return RENDERABLE_RANGES.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, offset) => String.fromCodePoint(first + offset)));
}

/** Text as a preview image may draw it: one line of characters the shipped fonts cover, cut to a length that fits. */
export function toRenderableText(text: string | null | undefined, maxLength: number): string {
  const characters = [...(text ?? "").normalize("NFC")].map(character => (WHITESPACE.test(character) ? " " : character)).filter(isRenderableCharacter);
  const singleSpaced = characters.join("").replace(/ {2,}/g, " ").trim();

  return truncate(singleSpaced, maxLength);
}

function truncate(text: string, maxLength: number): string {
  const characters = [...text];
  if (characters.length <= maxLength) return text;

  return `${characters
    .slice(0, maxLength - 1)
    .join("")
    .trimEnd()}${ELLIPSIS}`;
}
