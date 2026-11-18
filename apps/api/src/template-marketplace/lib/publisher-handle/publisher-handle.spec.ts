import { describe, expect, it } from "vitest";

import { publisherHandleCandidates } from "./publisher-handle";

describe(publisherHandleCandidates.name, () => {
  it("offers a team's slug first, then numbered and random variants", () => {
    const candidates = publisherHandleCandidates({ type: "team", slug: "acme-labs", ownerUsername: "sam" }, () => "abcd1234");

    expect(candidates).toEqual([
      "acme-labs",
      "acme-labs-2",
      "acme-labs-3",
      "acme-labs-4",
      "acme-labs-5",
      "acme-labs-6",
      "acme-labs-7",
      "acme-labs-8",
      "acme-labs-9",
      "acme-labs-10",
      "acme-labs-abcd1234"
    ]);
  });

  it("offers a personal organization's owner username, made lowercase and url-safe, rather than its slug", () => {
    const [first] = publisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: "Sam.Rivera_42" }, () => "abcd1234");

    expect(first).toBe("sam-rivera-42");
  });

  it.each([
    { shape: "a personal organization whose owner has no username", source: { type: "personal" as const, slug: "personal-0123456789ab", ownerUsername: null } },
    { shape: "a username that reads as Akash's", source: { type: "personal" as const, slug: "personal-0123456789ab", ownerUsername: "akash-official" } },
    { shape: "a team slug that reads as Akash's", source: { type: "team" as const, slug: "0fficial-templates", ownerUsername: "sam" } },
    { shape: "a username with nothing url-safe in it", source: { type: "personal" as const, slug: "personal-0123456789ab", ownerUsername: "___" } }
  ])("offers a neutral handle for $shape", ({ source }) => {
    const candidates = publisherHandleCandidates(source, () => "abcd1234");

    expect(candidates[0]).toBe("publisher-abcd1234");
    expect(candidates.every(candidate => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(candidate))).toBe(true);
  });

  it("draws a random suffix of its own when none is given", () => {
    const [first] = publisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: null });

    expect(first).toMatch(/^publisher-[0-9a-f]{8}$/);
  });
});
