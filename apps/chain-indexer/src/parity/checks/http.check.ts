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
    const parts = [
      await this.#runPart("block-detail", () => this.#blockDetail()),
      await this.#runPart("blocks-list", () => this.#blocksList()),
      await this.#runPart("address-transactions", () => this.#addressTransactions()),
      await this.#runPart("network-stats", () => this.#networkStats())
    ];
    const mismatches = parts.flatMap(part => part.mismatches);
    const status = mismatches.length > 0 ? "fail" : parts.every(part => part.skipped) ? "skipped" : "pass";
    return { name: this.name, status, summary: parts.map(part => `${part.name}: ${part.summary}`).join("; "), mismatches };
  }

  /** One unreachable endpoint fails its own part and leaves the other parts' evidence in the report. */
  async #runPart(name: string, part: () => Promise<Part>): Promise<Part> {
    try {
      return await part();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { name, summary: `threw: ${message}`, skipped: false, mismatches: [{ subject: name, expected: "HTTP 200 from both sides", actual: message }] };
    }
  }

  async #blockDetail(): Promise<Part> {
    const name = "block-detail";
    const { heights } = this.#options;
    if (heights.length === 0) return { name, summary: "skipped (no heights configured)", skipped: true, mismatches: [] };

    const mismatches: Mismatch[] = [];
    let unreached = 0;
    for (const height of heights) {
      const [legacy, v2] = await Promise.all([this.#legacy(`/v1/blocks/${height}`), this.#v2(`/v1/blocks/${height}`)]);
      const comparison = compareResources(`block ${height}`, legacy, v2, normalizeLegacyBlock, normalizeV2Block);
      if (comparison === undefined) {
        unreached++;
        continue;
      }
      mismatches.push(...comparison);
    }

    const comparable = heights.length - unreached;
    if (comparable === 0) return { name, summary: "skipped (no configured height reached on both sides)", skipped: true, mismatches: [] };
    const summary = agreement(comparable, "height", "heights", mismatches.length);
    return { name, summary: unreached === 0 ? summary : `${summary}, ${unreached} not reached on both sides`, skipped: false, mismatches };
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
      mismatches.push(...compareAddressHistory(`address ${address}`, aligned.legacy, aligned.v2));
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

/** Undefined means neither side serves the resource, which is a tip gap to skip, not an agreement. */
function compareResources<T>(
  subject: string,
  legacy: JsonResponse,
  v2: JsonResponse,
  normalizeLegacy: (body: unknown) => T,
  normalizeV2: (body: unknown) => T
): Mismatch[] | undefined {
  if (legacy.status !== 200 || v2.status !== 200) {
    return legacy.status === v2.status ? undefined : [{ subject, expected: { status: legacy.status }, actual: { status: v2.status } }];
  }
  return diffJson(normalizeLegacy(legacy.body), normalizeV2(v2.body), subject);
}

/** Entries are matched by hash, so one transaction present on a single side is reported once instead of shifting every entry after it. */
function compareAddressHistory(subject: string, legacy: NormalizedAddressTransactions, v2: NormalizedAddressTransactions): Mismatch[] {
  const mismatches: Mismatch[] = [];
  if (legacy.total !== v2.total) {
    mismatches.push({ subject: `${subject}.total`, expected: legacy.total, actual: v2.total });
  }

  const v2ByHash = new Map(v2.transactions.map(tx => [tx.hash, tx]));
  for (const tx of legacy.transactions) {
    const counterpart = v2ByHash.get(tx.hash);
    if (!counterpart) {
      mismatches.push({ subject: `${subject}.transactions[${tx.hash}]`, expected: `present at height ${tx.height}`, actual: "missing" });
      continue;
    }
    mismatches.push(...diffJson(tx, counterpart, `${subject}.transactions[${tx.hash}]`));
    v2ByHash.delete(tx.hash);
  }
  for (const tx of v2ByHash.values()) {
    mismatches.push({ subject: `${subject}.transactions[${tx.hash}]`, expected: "missing", actual: `present at height ${tx.height}` });
  }
  return mismatches;
}

/** Both pages are newest first: entries above the other side's newest height come from a tip gap, and entries below the other side's oldest fall outside its page, so neither says anything about what was indexed. */
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
  const legacyBelowTop = legacy.transactions.filter(tx => (tx.height ?? 0) <= sharedTop);
  const v2BelowTop = v2.transactions.filter(tx => (tx.height ?? 0) <= sharedTop);
  if (legacyBelowTop.length === 0 || v2BelowTop.length === 0) return undefined;

  const sharedFloor = Math.max(oldestHeight(legacyBelowTop), oldestHeight(v2BelowTop));
  return {
    legacy: {
      total: legacy.total - (legacy.transactions.length - legacyBelowTop.length),
      transactions: legacyBelowTop.filter(tx => (tx.height ?? 0) >= sharedFloor)
    },
    v2: { total: v2.total - (v2.transactions.length - v2BelowTop.length), transactions: v2BelowTop.filter(tx => (tx.height ?? 0) >= sharedFloor) }
  };
}

function oldestHeight(transactions: NormalizedAddressTransactions["transactions"]): number {
  return transactions[transactions.length - 1].height ?? 0;
}

function agreement(count: number, singular: string, plural: string, differences: number): string {
  const noun = count === 1 ? singular : plural;
  if (differences === 0) return `${count} ${noun} ${count === 1 ? "agrees" : "agree"}`;
  return `${count} ${noun} compared, ${differences} ${differences === 1 ? "difference" : "differences"}`;
}
