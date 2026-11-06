import { describe, expect, it } from "vitest";

import { assistantKnowledge, chunkDocument, KnowledgeIndex, tokenize } from "./assistant-knowledge";
import { ASSISTANT_KNOWLEDGE_DOCUMENTS, ASSISTANT_KNOWLEDGE_PACK_VERSION } from "./assistant-knowledge-pack";

describe("assistant knowledge", () => {
  describe(tokenize.name, () => {
    it("lowercases words and numbers and drops stop words", () => {
      expect(tokenize("Why is my GPU deployment OOMKilled after 2 hours?")).toEqual(["gpu", "deployment", "oomkilled", "after", "2", "hours"]);
    });

    it("returns nothing for text without words", () => {
      expect(tokenize("?!")).toEqual([]);
    });
  });

  describe(chunkDocument.name, () => {
    it("splits a document into one chunk per second-level heading", () => {
      const chunks = chunkDocument({ id: "doc", title: "Doc", source: "repo", markdown: "\n## First part\nAlpha text.\nMore.\n\n## Second\nBeta.\n" });

      expect(chunks).toEqual([
        { id: "doc#first-part", title: "Doc: First part", source: "repo", text: "Alpha text.\nMore." },
        { id: "doc#second", title: "Doc: Second", source: "repo", text: "Beta." }
      ]);
    });
  });

  describe(KnowledgeIndex.name, () => {
    const chunks = [
      { id: "a", title: "Bids", source: "s", text: "providers bid when they have capacity for the gpu" },
      { id: "b", title: "Billing", source: "s", text: "credits fund deployments, auto recharge charges the card" },
      { id: "c", title: "Long", source: "s", text: `gpu ${"filler ".repeat(200)}` }
    ];

    it("ranks matching chunks with BM25, shorter matches first, and reports the version", () => {
      const result = new KnowledgeIndex(chunks, "v1").search("gpu bids");

      expect(result.version).toBe("v1");
      expect(result.results.map(({ id }) => id)).toEqual(["a", "c"]);
      expect(result.results[0].score).toBeGreaterThan(result.results[1].score);
    });

    it("counts repeated terms in a chunk and in the query once per query term", () => {
      const index = new KnowledgeIndex(
        [
          { id: "once", title: "t", source: "s", text: "credits other words here" },
          { id: "twice", title: "t", source: "s", text: "credits credits other words" }
        ],
        "v1"
      );

      expect(index.search("credits credits").results.map(({ id }) => id)).toEqual(["twice", "once"]);
    });

    it("limits the results and drops chunks that match nothing", () => {
      const index = new KnowledgeIndex(chunks, "v1");

      expect(index.search("gpu", 1).results.map(({ id }) => id)).toEqual(["a"]);
      expect(index.search("kubernetes").results).toEqual([]);
    });

    it("answers nothing from an empty index", () => {
      expect(new KnowledgeIndex([], "v0").search("gpu")).toEqual({ version: "v0", results: [] });
    });
  });

  describe("assistantKnowledge", () => {
    it("indexes the versioned pack", () => {
      expect(assistantKnowledge.version).toBe(ASSISTANT_KNOWLEDGE_PACK_VERSION);
      expect(ASSISTANT_KNOWLEDGE_DOCUMENTS.flatMap(chunkDocument).length).toBeGreaterThan(20);
    });

    it.each([
      ["what can I change without redeploying", "sdl-essentials#change-after-deployment-created"],
      ["OOMKilled out of memory", "troubleshooting-runtime#out-memory"],
      ["ImagePullBackOff private registry", "troubleshooting-runtime#image-fails-pull"],
      ["auto recharge", "console-billing#auto-recharge"],
      ["custom domain CNAME", "console-domains#custom-domains"]
    ])("finds the right chunk for %s", (query, chunkId) => {
      expect(assistantKnowledge.search(query).results[0].id).toBe(chunkId);
    });
  });
});
