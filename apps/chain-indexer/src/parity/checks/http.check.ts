import type { NormalizedAddressTransactions, NormalizedBlockSummary } from "@src/parity/checks/http-normalizers";
import {
  normalizeLegacyAddressTransactions,
  normalizeLegacyBlock,
  normalizeLegacyBlockSummaries,
  normalizeLegacyNetworkStats,
  normalizeV2AddressTransactions,
  normalizeV2Block,
  normalizeV2BlockSummaries,
  normalizeV2NetworkStats
} from "@src/parity/checks/http-normalizers";
import { diffJson } from "@src/parity/json-diff";
import type { CheckResult, Mismatch, ParityCheck } from "@src/parity/report";
import type { Fetch } from "@src/providers/fetch.provider";

export interface HttpCheckOptions {
  legacyBaseUrl: string;
  v2BaseUrl: string;
  heights: number[];
  addresses: string[];
  sampleLimit: number;
}

interface Part {
  name: string;
  summary: string;
  skipped: boolean;
  mismatches: Mismatch[];
}

interface JsonResponse {
  status: number;
  body: unknown;
}

/** Compares what the legacy Console API and the api role serve for the endpoints the delegation layer switches over, field by field after both are reduced to a shared shape. */
export class HttpCheck implements ParityCheck {
  readonly name = "http";
  readonly #fetch: Fetch;
  readonly #options: HttpCheckOptions;

  constructor(fetch: Fetch, options: HttpCheckOptions) {
    this.#fetch = fetch;
    this.#options = options;
  }

  async run(): Promise<CheckResult> {
    const parts = [await this.#blockDetail(), await this.#blocksList(), await this.#addressTransactions(), await this.#networkStats()];
    const mismatches = parts.flatMap(part => part.mismatches);
    const status = mismatches.length > 0 ? "fail" : parts.every(part => part.skipped) ? "skipped" : "pass";
    return { name: this.name, status, summary: parts.map(part => `${part.name}: ${part.summary}`).join("; "), mismatches };
  }

  async #blockDetail(): Promise<Part> {
    const name = "block-detail";
    const { heights } = this.#options;
    if (heights.length === 0) return { name, summary: "skipped (no heights configured)", skipped: true, mismatches: [] };

    const mismatches: Mismatch[] = [];
    for (const height of heights) {
      const [legacy, v2] = await Promise.all([this.#legacy(`/v1/blocks/${height}`), this.#v2(`/v1/blocks/${height}`)]);
      mismatches.push(...compareResources(`block ${height}`, legacy, v2, normalizeLegacyBlock, normalizeV2Block));
    }
    return { name, summary: agreement(heights.length, "height", "heights", mismatches.length), skipped: false, mismatches };
  }

  async #blocksList(): Promise<Part> {
    const name = "blocks-list";
    const query = `/v1/blocks?limit=${this.#options.sampleLimit}`;
    const [legacy, v2] = await Promise.all([this.#legacyOk(query), this.#v2Ok(query)]);
    const legacyByHeight = normalizeLegacyBlockSummaries(legacy);
    const v2ByHeight = normalizeV2BlockSummaries(v2);
    const shared = [...legacyByHeight.keys()].filter(height => v2ByHeight.has(height));
    if (shared.length === 0) return { name, summary: "skipped (no shared heights)", skipped: true, mismatches: [] };

    const mismatches = shared.flatMap(height => diffJson(legacyByHeight.get(height) as NormalizedBlockSummary, v2ByHeight.get(height), `block ${height}`));
    return { name, summary: agreement(shared.length, "shared height", "shared heights", mismatches.length), skipped: false, mismatches };
  }

  async #addressTransactions(): Promise<Part> {
    const name = "address-transactions";
    const { addresses, sampleLimit } = this.#options;
    if (addresses.length === 0) return { name, summary: "skipped (no addresses configured)", skipped: true, mismatches: [] };

    const mismatches: Mismatch[] = [];
    let notComparable = 0;
    for (const address of addresses) {
      const [legacy, v2] = await Promise.all([
        this.#legacy(`/v1/addresses/${address}/transactions/0/${sampleLimit}`),
        this.#v2(`/v1/addresses/${address}/transactions?skip=0&limit=${sampleLimit}`)
      ]);
      const aligned = alignOnNewestSharedHeight(normalizeLegacyAddressTransactions(legacy.body), normalizeV2AddressTransactions(v2.body));
      if (aligned === undefined) {
        notComparable++;
        continue;
      }
      mismatches.push(...diffJson(aligned.legacy, aligned.v2, `address ${address}`));
    }
    const summary = agreement(addresses.length - notComparable, "address", "addresses", mismatches.length);
    return {
      name,
      summary: notComparable === 0 ? summary : `${summary}, ${notComparable} not comparable (tip gap wider than the page)`,
      skipped: notComparable === addresses.length,
      mismatches
    };
  }

  async #networkStats(): Promise<Part> {
    const name = "network-stats";
    const [dashboard, stats] = await Promise.all([this.#legacyOk("/v1/dashboard-data"), this.#v2Ok("/v1/network-stats?days=0")]);
    const legacy = normalizeLegacyNetworkStats((dashboard as { now: unknown }).now);
    const v2 = normalizeV2NetworkStats(stats);
    if (legacy.height !== v2.height) return { name, summary: `skipped (legacy at ${legacy.height}, v2 at ${v2.height})`, skipped: true, mismatches: [] };

    const mismatches = diffJson(legacy, v2, `network-stats@${legacy.height}`);
    return {
      name,
      summary: mismatches.length === 0 ? `agree at height ${legacy.height}` : `differ at height ${legacy.height} (${mismatches.length} differences)`,
      skipped: false,
      mismatches
    };
  }

  async #legacy(path: string): Promise<JsonResponse> {
    return this.#fetchJson(`${this.#options.legacyBaseUrl}${path}`);
  }

  async #v2(path: string): Promise<JsonResponse> {
    const response = await this.#fetchJson(`${this.#options.v2BaseUrl}${path}`);
    return { status: response.status, body: response.status === 200 ? (response.body as { data: unknown }).data : response.body };
  }

  async #legacyOk(path: string): Promise<unknown> {
    return requireOk(`${this.#options.legacyBaseUrl}${path}`, await this.#legacy(path));
  }

  async #v2Ok(path: string): Promise<unknown> {
    return requireOk(`${this.#options.v2BaseUrl}${path}`, await this.#v2(path));
  }

  async #fetchJson(url: string): Promise<JsonResponse> {
    const response = await this.#fetch(url, { headers: { accept: "application/json" } });
    return { status: response.status, body: response.status === 200 ? await response.json() : undefined };
  }
}

function requireOk(url: string, response: JsonResponse): unknown {
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.body;
}

function compareResources<T>(
  subject: string,
  legacy: JsonResponse,
  v2: JsonResponse,
  normalizeLegacy: (body: unknown) => T,
  normalizeV2: (body: unknown) => T
): Mismatch[] {
  if (legacy.status !== 200 || v2.status !== 200) {
    return legacy.status === v2.status ? [] : [{ subject, expected: { status: legacy.status }, actual: { status: v2.status } }];
  }
  return diffJson(normalizeLegacy(legacy.body), normalizeV2(v2.body), subject);
}

/** Both pages are newest first, so entries above the other side's newest height come from a tip gap, not from a difference in what was indexed. */
function alignOnNewestSharedHeight(
  legacy: NormalizedAddressTransactions,
  v2: NormalizedAddressTransactions
): { legacy: NormalizedAddressTransactions; v2: NormalizedAddressTransactions } | undefined {
  const legacyTop = legacy.transactions[0]?.height;
  const v2Top = v2.transactions[0]?.height;
  if (legacyTop === undefined || v2Top === undefined) {
    return legacy.transactions.length === v2.transactions.length ? { legacy, v2 } : undefined;
  }

  const sharedTop = Math.min(legacyTop, v2Top);
  const legacyKept = legacy.transactions.filter(tx => (tx.height ?? 0) <= sharedTop);
  const v2Kept = v2.transactions.filter(tx => (tx.height ?? 0) <= sharedTop);
  if (legacyKept.length === 0 || v2Kept.length === 0) return undefined;

  const comparable = Math.min(legacyKept.length, v2Kept.length);
  return {
    legacy: { total: legacy.total - (legacy.transactions.length - legacyKept.length), transactions: legacyKept.slice(0, comparable) },
    v2: { total: v2.total - (v2.transactions.length - v2Kept.length), transactions: v2Kept.slice(0, comparable) }
  };
}

function agreement(count: number, singular: string, plural: string, differences: number): string {
  const noun = count === 1 ? singular : plural;
  if (differences === 0) return `${count} ${noun} ${count === 1 ? "agrees" : "agree"}`;
  return `${count} ${noun} compared, ${differences} ${differences === 1 ? "difference" : "differences"}`;
}
