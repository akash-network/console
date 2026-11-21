import { describe, expect, it } from "vitest";

import { isRenderableCharacter, listRenderableCharacters, toRenderableText } from "./preview-image-text";

describe(toRenderableText.name, () => {
  it("keeps plain, accented and Cyrillic text as written", () => {
    expect(toRenderableText("Llama 3.1 – “chat” server für Señor Dvořák, Привет…", 100)).toBe("Llama 3.1 – “chat” server für Señor Dvořák, Привет…");
  });

  it("drops emoji, scripts the shipped fonts lack and invisible characters", () => {
    expect(toRenderableText("Rocket 🚀 模板 قالب ​zero‮width\u0000 ©", 100)).toBe("Rocket zerowidth");
  });

  it("keeps markup as inert text", () => {
    expect(toRenderableText('<img src=x onerror=alert(1)>"&', 100)).toBe('<img src=x onerror=alert(1)>"&');
  });

  it("puts a title written over several lines and tabs on one line with single spaces", () => {
    expect(toRenderableText("  one\n\ntwo\t three four five  ", 100)).toBe("one two three four five");
  });

  it("joins a decomposed accent with its letter instead of dropping it", () => {
    expect(toRenderableText("Café", 100)).toBe("Café");
  });

  it("returns nothing for a missing text", () => {
    expect(toRenderableText(null, 100)).toBe("");
    expect(toRenderableText(undefined, 100)).toBe("");
  });

  it("returns nothing when no character can be drawn", () => {
    expect(toRenderableText("🚀🚀 模板", 100)).toBe("");
  });

  it("leaves a text exactly as long as the limit whole", () => {
    expect(toRenderableText("abcdefghij", 10)).toBe("abcdefghij");
  });

  it("cuts a longer text to the limit, ending in an ellipsis", () => {
    const cut = toRenderableText("abcdefghijk", 10);

    expect(cut).toBe("abcdefghi…");
    expect([...cut]).toHaveLength(10);
  });

  it("leaves no space before the ellipsis", () => {
    expect(toRenderableText("abcdefgh ijklm", 10)).toBe("abcdefgh…");
  });

  it("measures the limit on what is left after the characters it cannot draw are dropped", () => {
    expect(toRenderableText("🚀🚀🚀🚀🚀🚀abcdefghij", 10)).toBe("abcdefghij");
  });
});

describe(isRenderableCharacter.name, () => {
  it.each(["a", "Z", "0", " ", "~", "¡", "ÿ", "Ā", "ž", "Ѐ", "џ", "–", "—", "‘", "‚", "“", "„", "…"])("accepts %j", character => {
    expect(isRenderableCharacter(character)).toBe(true);
  });

  it.each(["\u001f", "\u007f", " ", "©", "­", "®", "Ĕ", "ĕ", "Ĭ", "ĸ", "Ŀ", "ŉ", "Ŏ", "ſ", "Ͽ", "Ѝ", "Ѡ", "‒", "―", "‗", "‛", "‟", "‥", "‧", "🚀", "模", ""])(
    "refuses %j",
    character => {
      expect(isRenderableCharacter(character)).toBe(false);
    }
  );
});

describe(listRenderableCharacters.name, () => {
  it("lists each accepted character once, from the first of a range to its last", () => {
    const characters = listRenderableCharacters();

    expect(new Set(characters).size).toBe(characters.length);
    expect(characters.every(isRenderableCharacter)).toBe(true);
    expect(characters).toEqual(
      expect.arrayContaining([
        " ",
        "~",
        "¡",
        "¨",
        "ª",
        "¬",
        "¯",
        "ÿ",
        "Ā",
        "ē",
        "Ė",
        "ī",
        "Į",
        "ķ",
        "Ĺ",
        "ľ",
        "Ł",
        "ň",
        "Ŋ",
        "ō",
        "Ő",
        "ž",
        "Ѐ",
        "Ќ",
        "Ў",
        "џ",
        "–",
        "—",
        "‘",
        "‚",
        "“",
        "„",
        "…"
      ])
    );
    expect(characters).toHaveLength(408);
  });
});
