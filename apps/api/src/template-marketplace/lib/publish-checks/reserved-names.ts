/** Shown to the user as written here; staff extend the list by adding a word. */
export const RESERVED_WORDS = ["Akash", "Official", "Console", "Overclock", "Verified", "Staff", "Support"] as const;

export type ReservedWord = (typeof RESERVED_WORDS)[number];

/** Spellings that read as a reserved word without containing it. */
const RESERVED_ALIASES: Readonly<Record<string, ReservedWord>> = { ovrclk: "Overclock" };

/** Words that keep a run-together name such as `akashnetwork` or `teamakash` reading as the reserved word inside it. */
const GLUE_WORDS = ["network", "net", "labs", "lab", "team", "cloud", "hq", "org", "dao", "app", "dev", "the", "by", "from", "for", "on", "io", "ai"];

/** Every character a letter is commonly swapped for; other scripts' homoglyphs are folded to Latin before matching. */
const LOOK_ALIKES: Readonly<Record<string, string>> = {
  a: "a4",
  e: "e3",
  i: "i1l",
  l: "l1i",
  o: "o0",
  s: "s5",
  t: "t7"
};

const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a",
  α: "a",
  в: "b",
  с: "c",
  ϲ: "c",
  ԁ: "d",
  е: "e",
  ε: "e",
  ѕ: "s",
  і: "i",
  ι: "i",
  ӏ: "l",
  к: "k",
  κ: "k",
  м: "m",
  н: "h",
  һ: "h",
  о: "o",
  ο: "o",
  р: "p",
  ρ: "p",
  т: "t",
  τ: "t",
  υ: "u",
  ν: "v",
  х: "x",
  у: "y",
  ƒ: "f"
};

const SYMBOL_LETTERS: Readonly<Record<string, string>> = { "@": "a", $: "s", "!": "i", "|": "l", "+": "t" };

const COMBINING_MARKS_AND_INVISIBLES = /[\p{M}\p{Cf}]/gu;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]+/u;

function lookAlikePattern(word: string): string {
  return [...word].map(letter => `[${LOOK_ALIKES[letter] ?? letter}]`).join("");
}

const RESERVED_SPELLINGS: ReadonlyArray<[string, ReservedWord]> = [
  ...RESERVED_WORDS.map((word): [string, ReservedWord] => [word.toLowerCase(), word]),
  ...Object.entries(RESERVED_ALIASES)
];

const RESERVED_PATTERNS: ReadonlyArray<[RegExp, ReservedWord]> = RESERVED_SPELLINGS.map(([spelling, word]) => [new RegExp(lookAlikePattern(spelling)), word]);

const ANY_RESERVED = RESERVED_SPELLINGS.map(([spelling]) => lookAlikePattern(spelling)).join("|");
/** One digit at a time: a repeated digit run inside the repeated group would backtrack exponentially on a long number. */
const ANY_GLUE = [...GLUE_WORDS, String.raw`\d`].join("|");

/** A token counts only when it is nothing but reserved and glue words, so `akashic` or `consoled` pass while `akash-network2` does not. */
const RESERVED_TOKEN = new RegExp(`^(?:${ANY_GLUE})*(?:${ANY_RESERVED})(?:${ANY_RESERVED}|${ANY_GLUE})*$`);

/** Answers each reserved word a name uses as a whole word, whatever its case, spacing, accents or look-alike characters. */
export function findReservedWords(name: string): ReservedWord[] {
  const folded = foldToLatin(name);
  const tokens = [...tokensOf(folded), ...tokensOf(replaceSymbolLetters(folded))];
  const reservedTokens = tokens.filter(token => RESERVED_TOKEN.test(token));

  return RESERVED_WORDS.filter(word => reservedTokens.some(token => RESERVED_PATTERNS.some(([pattern, owner]) => owner === word && pattern.test(token))));
}

function foldToLatin(name: string): string {
  const normalized = name.normalize("NFKD").replace(COMBINING_MARKS_AND_INVISIBLES, "").toLowerCase();

  return [...normalized].map(character => HOMOGLYPHS[character] ?? character).join("");
}

function replaceSymbolLetters(text: string): string {
  return [...text].map(character => SYMBOL_LETTERS[character] ?? character).join("");
}

/** Letters spelled out one at a time, as in `a k a s h` or `o.f.f.i.c.i.a.l`, are read as the word they spell. */
function tokensOf(text: string): string[] {
  const tokens: string[] = [];
  let spelledOut = "";

  for (const part of text.split(NOT_LETTER_OR_DIGIT).filter(Boolean)) {
    if (part.length === 1) {
      spelledOut += part;
      continue;
    }

    if (spelledOut) tokens.push(spelledOut);
    spelledOut = "";
    tokens.push(part);
  }

  return spelledOut ? [...tokens, spelledOut] : tokens;
}
