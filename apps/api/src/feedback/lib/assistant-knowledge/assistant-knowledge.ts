import { ASSISTANT_KNOWLEDGE_DOCUMENTS, ASSISTANT_KNOWLEDGE_PACK_VERSION, type KnowledgeDocument } from "./assistant-knowledge-pack";

export interface KnowledgeChunk {
  id: string;
  title: string;
  source: string;
  text: string;
}

export interface KnowledgeSearchResult {
  version: string;
  results: (KnowledgeChunk & { score: number })[];
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DEFAULT_RESULT_LIMIT = 3;

/** Common words carry no signal and would let long chunks outrank precise ones. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "can",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "why",
  "with"
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(token => !STOP_WORDS.has(token));
}

export function chunkDocument(document: KnowledgeDocument): KnowledgeChunk[] {
  return document.markdown
    .split(/^## /m)
    .map(section => section.trim())
    .filter(Boolean)
    .map(section => {
      const [heading, ...body] = section.split("\n");
      return {
        id: `${document.id}#${tokenize(heading).join("-")}`,
        title: `${document.title}: ${heading.trim()}`,
        source: document.source,
        text: body.join("\n").trim()
      };
    });
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  termCounts: Map<string, number>;
  length: number;
}

export class KnowledgeIndex {
  readonly #chunks: IndexedChunk[];
  readonly #documentFrequency = new Map<string, number>();
  readonly #averageLength: number;

  constructor(
    chunks: KnowledgeChunk[],
    readonly version: string
  ) {
    this.#chunks = chunks.map(chunk => {
      const tokens = tokenize(`${chunk.title} ${chunk.text}`);
      const termCounts = new Map<string, number>();
      tokens.forEach(token => termCounts.set(token, (termCounts.get(token) ?? 0) + 1));
      termCounts.forEach((_, term) => this.#documentFrequency.set(term, (this.#documentFrequency.get(term) ?? 0) + 1));

      return { chunk, termCounts, length: tokens.length };
    });
    this.#averageLength = this.#chunks.reduce((total, { length }) => total + length, 0) / Math.max(this.#chunks.length, 1);
  }

  search(query: string, limit = DEFAULT_RESULT_LIMIT): KnowledgeSearchResult {
    const terms = [...new Set(tokenize(query))];
    const results = this.#chunks
      .map(indexed => ({ ...indexed.chunk, score: this.#score(indexed, terms) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return { version: this.version, results };
  }

  #score({ termCounts, length }: IndexedChunk, terms: string[]): number {
    return terms.reduce((score, term) => {
      const frequency = termCounts.get(term) ?? 0;
      if (frequency === 0) return score;

      const documentFrequency = this.#documentFrequency.get(term) ?? 0;
      const inverseFrequency = Math.log(1 + (this.#chunks.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const lengthNorm = 1 - BM25_B + (BM25_B * length) / this.#averageLength;

      return score + (inverseFrequency * frequency * (BM25_K1 + 1)) / (frequency + BM25_K1 * lengthNorm);
    }, 0);
  }
}

export const assistantKnowledge = new KnowledgeIndex(ASSISTANT_KNOWLEDGE_DOCUMENTS.flatMap(chunkDocument), ASSISTANT_KNOWLEDGE_PACK_VERSION);
