import { describe, expect, it } from "vitest";

import { officialPublisherHandleCandidates, publisherHandleCandidates } from "./publisher-handle";

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

  it("offers no candidate that ends with a hyphen when the length limit cuts a username at one", () => {
    const candidates = publisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: `${"a".repeat(39)}-b` }, () => "abcd1234");

    expect(candidates[0]).toBe("a".repeat(39));
    expect(candidates.filter(candidate => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(candidate))).toEqual([]);
  });

  it("never offers the word the route of the caller's own publisher answers to", () => {
    const team = publisherHandleCandidates({ type: "team", slug: "current", ownerUsername: "sam" }, () => "abcd1234");
    const personal = publisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: "Current" }, () => "abcd1234");

    expect(team[0]).toBe("current-2");
    expect(team).toHaveLength(10);
    expect(personal).not.toContain("current");
    expect(personal).toContain("current-abcd1234");
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

describe(officialPublisherHandleCandidates.name, () => {
  it("offers the slug of the organization the import publishes for, a name every other publisher is kept from", () => {
    const akash = { type: "team" as const, slug: "akash", ownerUsername: "sam" };

    expect(officialPublisherHandleCandidates(akash, () => "abcd1234")).toEqual([
      "akash",
      "akash-2",
      "akash-3",
      "akash-4",
      "akash-5",
      "akash-6",
      "akash-7",
      "akash-8",
      "akash-9",
      "akash-10",
      "akash-abcd1234"
    ]);
    expect(publisherHandleCandidates(akash, () => "abcd1234")[0]).toBe("publisher-abcd1234");
  });

  it("offers a personal organization's username, and never the word the route of the caller's own publisher answers to", () => {
    const personal = officialPublisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: "Akash-Network" }, () => "abcd1234");
    const current = officialPublisherHandleCandidates({ type: "team", slug: "current", ownerUsername: null }, () => "abcd1234");
    const nameless = officialPublisherHandleCandidates({ type: "personal", slug: "personal-0123456789ab", ownerUsername: null }, () => "abcd1234");

    expect(personal[0]).toBe("akash-network");
    expect(current[0]).toBe("current-2");
    expect(nameless[0]).toBe("publisher-abcd1234");
  });
});
