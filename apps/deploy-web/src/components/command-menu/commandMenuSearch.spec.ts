import { describe, expect, it } from "vitest";

import type { CommandSection, SearchableItem } from "./commandMenuSearch";
import { applyScope, cycleScope, parseQuery, rankSections, scoreItem, scoreText } from "./commandMenuSearch";

describe(scoreText.name, () => {
  it("scores a prefix match highest", () => {
    expect(scoreText("New deployment", "new")).toBe(100);
  });

  it.each([" ", "-", "_", "/", ".", ":"])("scores a match right after %j as the start of a word", separator => {
    expect(scoreText(`x${separator}abc`, "abc")).toBeCloseTo(79.8);
  });

  it("scores a match inside a word lower than one at a word start", () => {
    expect(scoreText("Billing", "ill")).toBeCloseTo(49.9);
  });

  it("stops penalising the position after 20 characters", () => {
    expect(scoreText(`${"a".repeat(24)} xyz`, "xyz")).toBeCloseTo(78);
    expect(scoreText(`${"a".repeat(30)}xyz`, "xyz")).toBeCloseTo(48);
  });

  it("compares case-insensitively against a lowercase query", () => {
    expect(scoreText("API Keys", "keys")).toBeCloseTo(79.6);
  });

  it("scores nothing for an empty query, empty text or missing text", () => {
    expect(scoreText("Billing", "")).toBe(0);
    expect(scoreText("", "bill")).toBe(0);
    expect(scoreText(undefined, "bill")).toBe(0);
  });

  it("matches word initials only when loose", () => {
    expect(scoreText("New deployment", "nd", true)).toBe(45);
    expect(scoreText("New deployment", "nd")).toBe(0);
  });

  it("lets initials continue inside a word", () => {
    expect(scoreText("New deployment", "nde", true)).toBe(45);
  });

  it("refuses initials when a letter starts no later word", () => {
    expect(scoreText("New deployment", "nx", true)).toBe(0);
  });

  it.each([
    { query: "tmpl", score: 32 },
    { query: "tpl", score: 29 },
    { query: "tla", score: 26 }
  ])("scores in-order letters $query in Templates by how many characters they skip", ({ query, score }) => {
    expect(scoreText("Templates", query, true)).toBe(score);
  });

  it("gives up on in-order letters that skip more than 3 characters", () => {
    expect(scoreText("Templates", "ts", true)).toBe(0);
  });

  it("gives up on letters that are out of order", () => {
    expect(scoreText("Billing", "lb", true)).toBe(0);
  });

  it("matches nothing that is not in the text", () => {
    expect(scoreText("Templates", "z", true)).toBe(0);
  });
});

describe(scoreItem.name, () => {
  it("takes the label score at full weight", () => {
    expect(scoreItem({ id: "a", label: "Billing" }, "bill")).toBe(100);
  });

  it("weighs a keyword match at 0.6", () => {
    expect(scoreItem({ id: "a", label: "Add funds", keywords: "top up" }, "top")).toBeCloseTo(60);
  });

  it("weighs a meta match at 0.4", () => {
    expect(scoreItem({ id: "a", label: "web", meta: "DSEQ 1234" }, "dseq")).toBeCloseTo(40);
  });

  it("keeps the best of the three scores", () => {
    expect(scoreItem({ id: "a", label: "xbill", keywords: "bill", meta: "bill" }, "bill")).toBeCloseTo(60);
  });

  it("only applies the loose matching to the label", () => {
    expect(scoreItem({ id: "a", label: "x", keywords: "new deployment", meta: "new deployment" }, "nd")).toBe(0);
  });
});

describe(parseQuery.name, () => {
  it.each([
    { input: "> new", prefix: ">", scope: "actions" },
    { input: ">new", prefix: ">", scope: "actions" },
    { input: "@ new", prefix: "@", scope: "deployments" },
    { input: "/new", prefix: "/", scope: "pages" }
  ])("reads $input as the $scope scope", ({ input, prefix, scope }) => {
    expect(parseQuery(input)).toEqual({ prefix, scope, query: "new" });
  });

  it("trims and lowercases the query", () => {
    expect(parseQuery("  New Deployment  ")).toEqual({ prefix: null, scope: null, query: "new deployment" });
    expect(parseQuery(">   New  ")).toEqual({ prefix: ">", scope: "actions", query: "new" });
  });

  it("treats any other leading character as part of the query", () => {
    expect(parseQuery("#web")).toEqual({ prefix: null, scope: null, query: "#web" });
  });

  it("reads an empty input as no scope and no query", () => {
    expect(parseQuery("")).toEqual({ prefix: null, scope: null, query: "" });
  });
});

describe(applyScope.name, () => {
  it("adds a prefix in front of the typed text", () => {
    expect(applyScope("Deploy", ">")).toBe("> Deploy");
  });

  it("replaces the current prefix", () => {
    expect(applyScope("> new", "@")).toBe("@ new");
  });

  it("removes the prefix and the spaces after it", () => {
    expect(applyScope(">   new", null)).toBe("new");
  });

  it("keeps trailing spaces the user typed", () => {
    expect(applyScope("new  ", "/")).toBe("/ new  ");
  });

  it("leaves a bare prefix when nothing is typed", () => {
    expect(applyScope("", "/")).toBe("/ ");
  });
});

describe(cycleScope.name, () => {
  it.each([
    { input: "new", next: "> new" },
    { input: "> new", next: "@ new" },
    { input: "@ new", next: "/ new" },
    { input: "/ new", next: "new" }
  ])("moves forward from $input to $next", ({ input, next }) => {
    expect(cycleScope(input, 1)).toBe(next);
  });

  it.each([
    { input: "new", previous: "/ new" },
    { input: "/ new", previous: "@ new" },
    { input: "> new", previous: "new" }
  ])("moves backward from $input to $previous", ({ input, previous }) => {
    expect(cycleScope(input, -1)).toBe(previous);
  });
});

describe(rankSections.name, () => {
  describe("with an empty query", () => {
    it("keeps every section and item in order", () => {
      const sections = [section("actions", ["New deployment", "Add funds"]), section("pages", ["Billing"])];

      expect(labelsOf(rankSections(sections, parseQuery("")))).toEqual([
        ["actions", ["New deployment", "Add funds"]],
        ["pages", ["Billing"]]
      ]);
    });

    it("caps a section at its empty-query limit", () => {
      const sections = [section("deployments", ["a", "b", "c", "d", "e", "f"], 5)];

      expect(labelsOf(rankSections(sections, parseQuery("")))).toEqual([["deployments", ["a", "b", "c", "d", "e"]]]);
    });

    it("caps a section without a limit at 50 items", () => {
      const sections = [section("pages", numbered(60))];

      expect(rankSections(sections, parseQuery(""))[0].items).toHaveLength(50);
    });

    it("drops sections without items", () => {
      const sections = [section("actions", []), section("pages", ["Billing"])];

      expect(labelsOf(rankSections(sections, parseQuery("")))).toEqual([["pages", ["Billing"]]]);
    });

    it("shows only the scoped section, up to 50 items, ignoring its empty-query limit", () => {
      const sections = [section("actions", ["New deployment"]), section("deployments", numbered(60), 5)];

      const ranked = rankSections(sections, parseQuery("@"));

      expect(ranked.map(({ key }) => key)).toEqual(["deployments"]);
      expect(ranked[0].items).toHaveLength(50);
    });
  });

  describe("with a query", () => {
    it("keeps matching items, strongest first", () => {
      const sections = [section("pages", ["Usage", "Billing", "Alerts", "Bill run"])];

      expect(labelsOf(rankSections(sections, parseQuery("bill")))).toEqual([["pages", ["Billing", "Bill run"]]]);
    });

    it("orders items by score", () => {
      const sections = [section("pages", ["sub billing", "billing", "rebill"])];

      expect(labelsOf(rankSections(sections, parseQuery("bill")))).toEqual([["pages", ["billing", "sub billing", "rebill"]]]);
    });

    it("keeps the top 6 matches of a section", () => {
      const sections = [section("deployments", numbered(8))];

      expect(rankSections(sections, parseQuery("item"))[0].items).toHaveLength(6);
    });

    it("keeps up to 50 matches inside a scope", () => {
      const sections = [section("deployments", numbered(60))];

      expect(rankSections(sections, parseQuery("@ item"))[0].items).toHaveLength(50);
    });

    it("puts the section holding the strongest match first", () => {
      const sections = [section("actions", ["Rebill account"]), section("deployments", ["Add funds"]), section("pages", ["Billing"])];

      expect(labelsOf(rankSections(sections, parseQuery("bil")))).toEqual([
        ["pages", ["Billing"]],
        ["actions", ["Rebill account"]]
      ]);
    });

    it("keeps the given order between sections that match equally well", () => {
      const sections = [section("actions", ["Billing"]), section("pages", ["Billing"])];

      expect(labelsOf(rankSections(sections, parseQuery("billing"))).map(([key]) => key)).toEqual(["actions", "pages"]);
    });

    it("searches only the scoped section", () => {
      const sections = [section("actions", ["Billing"]), section("pages", ["Billing"])];

      expect(labelsOf(rankSections(sections, parseQuery("/ billing")))).toEqual([["pages", ["Billing"]]]);
    });
  });

  function section(key: CommandSection<SearchableItem>["key"], labels: string[], emptyQueryLimit?: number): CommandSection<SearchableItem> {
    return { key, label: key, emptyQueryLimit, items: labels.map(label => ({ id: `${key}-${label}`, label })) };
  }

  function numbered(count: number) {
    return Array.from({ length: count }, (_, index) => `item ${index + 1}`);
  }

  function labelsOf(sections: CommandSection<SearchableItem>[]) {
    return sections.map(({ key, items }) => [key, items.map(({ label }) => label)]);
  }
});
