import { describe, expect, it } from "vitest";

import { findReservedWords, RESERVED_WORDS } from "./reserved-names";

describe(findReservedWords.name, () => {
  it.each(RESERVED_WORDS.map(word => ({ word })))("finds $word as a whole word whatever its case", ({ word }) => {
    expect(findReservedWords(`My ${word.toUpperCase()} template`)).toEqual([word]);
    expect(findReservedWords(word.toLowerCase())).toEqual([word]);
  });

  it.each([
    { name: "Official Llama 3.1 Chat", words: ["Official"] },
    { name: "Akash Official Console", words: ["Akash", "Official", "Console"] },
    { name: "akash-network", words: ["Akash"] },
    { name: "AkashNetwork", words: ["Akash"] },
    { name: "TeamAkash", words: ["Akash"] },
    { name: "by_akash_labs", words: ["Akash"] },
    { name: "akashofficial", words: ["Akash", "Official"] },
    { name: "Akash2", words: ["Akash"] },
    { name: "2024akash", words: ["Akash"] },
    { name: "Akash's picks", words: ["Akash"] },
    { name: "0ff1c1a1 build", words: ["Official"] },
    { name: "4k45h", words: ["Akash"] },
    { name: "5t4ff picks", words: ["Staff"] },
    { name: "C0NS0LE", words: ["Console"] },
    { name: "Vérifiéd", words: ["Verified"] },
    { name: "Ａｋａｓｈ", words: ["Akash"] },
    { name: "Аkаsh", words: ["Akash"] },
    { name: "оffiсiаl", words: ["Official"] },
    { name: "Aka​sh", words: ["Akash"] },
    { name: "a k a s h", words: ["Akash"] },
    { name: "o.f.f.i.c.i.a.l web", words: ["Official"] },
    { name: "web s-t-a-f-f", words: ["Staff"] },
    { name: "St@ff picks", words: ["Staff"] },
    { name: "$upport desk", words: ["Support"] },
    { name: "Off!c!al", words: ["Official"] },
    { name: "Officia|", words: ["Official"] },
    { name: "S+aff", words: ["Staff"] },
    { name: "ovrclk tools", words: ["Overclock"] },
    { name: "Overclock Labs", words: ["Overclock"] },
    { name: "the-staff", words: ["Staff"] },
    { name: "thestaff", words: ["Staff"] },
    { name: "supportstaff", words: ["Staff", "Support"] }
  ])("finds $words in $name", ({ name, words }) => {
    expect(findReservedWords(name)).toEqual(words);
  });

  it.each([
    "Llama 3.1 Chat",
    "Unofficial Minecraft server",
    "Akashic records",
    "Consoled",
    "Supported models",
    "Supports GPU",
    "Overclocked GPU miner",
    "Staffing tool",
    "Unverified",
    "Bakasha",
    "network team cloud",
    "A K means",
    "web 2 0",
    "",
    "1".repeat(255),
    "akash".repeat(40) + "x"
  ])("finds nothing in %j", name => {
    expect(findReservedWords(name)).toEqual([]);
  });
});
