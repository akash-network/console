import { toBech32 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACT_MIGRATION_STREAMS, ActMigrationService } from "@src/bme/act-migration.service";
import { ActMigrationQueue, ActMigrationState, Deployments, IndexerState, Leases } from "@src/db/schema";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");
const EARLIER_PRICE = "0.626310480000000000";
const SAME_BLOCK_PRICE = "0.626185160000000000";
const BME_MODULE_ADDRESS = "akash1klpwzlvfnw7j8gtdd0cuu9vaw9ermsmd37sg55";
const SANDBOX_USDC_DENOM = "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E";

/**
 * Real akash addresses whose raw 20-byte order (leading byte 0x00 < 0x08 < 0x10, the chain's
 * `collections.Join(owner, dseq)` key order) is the reverse of their bech32-string order: bech32's
 * charset maps 0x08's leading group to 'p' and 0x00's to 'q', so a string sort would order them
 * `OWNER_BYTE_1` before `OWNER_BYTE_0`. These make a wrong string sort observable.
 */
const ownerWithLeadingByte = (leadingByte: number) => toBech32("akash", Uint8Array.from([leadingByte, ...new Array<number>(19).fill(0)]));
const OWNER_BYTE_0 = ownerWithLeadingByte(0x00);
const OWNER_BYTE_1 = ownerWithLeadingByte(0x08);
const OWNER_BYTE_2 = ownerWithLeadingByte(0x10);

describe(ActMigrationService.name, () => {
  describe("segment", () => {
    it("returns the whole batch as one segment when nothing triggers", async () => {
      const { service } = setup();
      const blocks = [block({ height: 10 }), block({ height: 11 })];

      const segments = await service.segment(blocks);

      expect(segments).toEqual([{ blocks, step: null, observations: { lastAktUsdPrice: null } }]);
    });

    it("fast-paths when the drained marker exists", async () => {
      const { service } = setup({ markers: ["upgrade", "drained"] });
      const blocks = [block({ height: 10, blockEvents: [vaultFundedEvent(), ...conversionBankEvents("9uakt", "5uact")] })];

      const segments = await service.segment(blocks);

      expect(segments[0].step).toBeNull();
    });

    it("splits at the first native BME event and schedules the upgrade step", async () => {
      const { service } = setup();
      const blocks = [block({ height: 10 }), block({ height: 11, blockEvents: [vaultFundedEvent()] }), block({ height: 12 })];

      const segments = await service.segment(blocks);

      expect(segments).toHaveLength(2);
      expect(segments[0].blocks).toEqual(blocks.slice(0, 2));
      expect(segments[0].step).toEqual(expect.objectContaining({ kind: "upgrade", height: 11 }));
      expect(segments[1]).toEqual({ blocks: blocks.slice(2), step: null, observations: { lastAktUsdPrice: null } });
    });

    it("schedules a drain at a conversion block using the latest price from strictly earlier blocks, not the block's own price", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30 });
      const blocks = [
        block({ height: 2552658, txEvents: [priceEvent(EARLIER_PRICE)] }),
        block({ height: 2552659 }),
        block({ height: 2552660, txEvents: [priceEvent(SAME_BLOCK_PRICE)], blockEvents: conversionBankEvents("9034806372uakt", "5658593148uact") })
      ];

      const segments = await service.segment(blocks);

      expect(segments).toHaveLength(1);
      expect(segments[0].step).toEqual(
        expect.objectContaining({
          kind: "drain",
          height: 2552660,
          aktUsdRate: EARLIER_PRICE,
          bankTotals: { burnedUakt: 9034806372n, burnedUsdc: 0n, mintedUact: 5658593148n }
        })
      );
    });

    it("throws when a conversion block appears before any oracle price was seen", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30 });
      const blocks = [block({ height: 20, blockEvents: conversionBankEvents("9uakt", "5uact") })];

      await expect(service.segment(blocks)).rejects.toThrow("no AKT/USD oracle price was seen");
    });

    it("does not schedule a drain without the burn and mint signature", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30, persistedPrice: EARLIER_PRICE });

      const segments = await service.segment([block({ height: 20, txEvents: [priceEvent(SAME_BLOCK_PRICE)] })]);

      expect(segments[0].step).toBeNull();
    });

    it("resumes mid-drain from the persisted price after a restart", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30, persistedPrice: EARLIER_PRICE });

      const segments = await service.segment([block({ height: 20, blockEvents: conversionBankEvents("9uakt", "5uact") })]);

      expect(segments[0].step).toEqual(expect.objectContaining({ kind: "drain", height: 20, aktUsdRate: EARLIER_PRICE }));
    });

    it("does not retain planning observations that were never committed", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30 });
      await service.segment([block({ height: 20, txEvents: [priceEvent(EARLIER_PRICE)] })]);

      await expect(service.segment([block({ height: 21, blockEvents: conversionBankEvents("9uakt", "5uact") })])).rejects.toThrow("no AKT/USD oracle price");
    });

    it("uses committed observations for later batches", async () => {
      const { service } = setup({ markers: ["upgrade"], queuePending: 30 });
      const primer = (await service.segment([block({ height: 20, txEvents: [priceEvent(EARLIER_PRICE)] })]))[0];
      service.markCommitted(primer, null);

      const segments = await service.segment([block({ height: 21, blockEvents: conversionBankEvents("9uakt", "5uact") })]);

      expect(segments[0].step).toEqual(expect.objectContaining({ kind: "drain", height: 21, aktUsdRate: EARLIER_PRICE }));
    });
  });

  describe("applySegment", () => {
    it("persists the segment's last observed price with a monotonic height guard", async () => {
      const { service, tx, recorded } = setup();
      const segment = planlessSegment({ lastAktUsdPrice: { price: EARLIER_PRICE, height: 20 } });

      const outcome = await service.applySegment(tx, segment);

      expect(outcome).toBeNull();
      expect(recorded.inserts.filter(insert => insert.table === ActMigrationState)).toEqual([
        expect.objectContaining({ rows: [{ id: 1, lastAktUsdPrice: EARLIER_PRICE, lastPriceHeight: 20 }] })
      ]);
    });

    it("does nothing when the segment carries no step and no price", async () => {
      const { service, tx, recorded } = setup();

      const outcome = await service.applySegment(tx, planlessSegment({}));

      expect(outcome).toBeNull();
      expect(recorded.inserts).toEqual([]);
      expect(recorded.updates).toEqual([]);
    });

    it("converts axlUSDC deployments at par and seeds the drain queue in the chain's address-byte then dseq order", async () => {
      const { service, tx, recorded } = setup({
        openDeployments: [
          { id: 3, denom: "uakt", balance: "10", dseq: "200", owner: OWNER_BYTE_0 },
          { id: 1, denom: "uusdc", balance: "19242170.5", dseq: "100", owner: OWNER_BYTE_2 },
          { id: 2, denom: "uakt", balance: "10", dseq: "50", owner: OWNER_BYTE_0 },
          { id: 4, denom: "uakt", balance: "10", dseq: "300", owner: OWNER_BYTE_1 }
        ],
        detectionResources: [
          { deploymentId: 3, gseq: 1, idx: 0, price: "5", priceDenom: "uakt" },
          { deploymentId: 1, gseq: 1, idx: 0, price: "5", priceDenom: SANDBOX_USDC_DENOM },
          { deploymentId: 2, gseq: 1, idx: 0, price: "5", priceDenom: "uakt" },
          { deploymentId: 4, gseq: 1, idx: 0, price: "5", priceDenom: "uakt" }
        ]
      });
      const step = upgradeStep({ height: 2552650, bankTotals: { burnedUakt: 0n, burnedUsdc: 19242170n, mintedUact: 19242170n } });

      const outcome = await service.applySegment(tx, segmentWith(step));

      expect(outcome).toEqual({ upgradeApplied: true, queueRemaining: 3, drained: false });
      expect(recorded.updates.find(update => update.table === Deployments)?.set).toEqual({ denom: "uact" });
      const queueInsert = recorded.inserts.find(insert => insert.table === ActMigrationQueue);
      expect(queueInsert?.rows).toEqual([
        { position: 0, deploymentId: 2 },
        { position: 1, deploymentId: 3 },
        { position: 2, deploymentId: 4 }
      ]);
    });

    it("marks the migration drained at the upgrade when no uakt deployment is open", async () => {
      const { service, tx, recorded } = setup({
        openDeployments: [{ id: 1, denom: "uusdc", balance: "5", dseq: "100", owner: "akash1aaa" }],
        detectionResources: [{ deploymentId: 1, gseq: 1, idx: 0, price: "5", priceDenom: SANDBOX_USDC_DENOM }]
      });

      const outcome = await service.applySegment(tx, segmentWith(upgradeStep({ height: 2552650 })));

      expect(outcome).toEqual({ upgradeApplied: true, queueRemaining: 0, drained: true });
      expect(recorded.inserts.filter(insert => insert.table === IndexerState).map(insert => (insert.rows as Array<{ stream: string }>)[0].stream)).toEqual([
        ACT_MIGRATION_STREAMS.upgrade,
        ACT_MIGRATION_STREAMS.drained
      ]);
    });

    it("skips the upgrade work when another writer already claimed it", async () => {
      const { service, tx, recorded } = setup({ claimRejects: [ACT_MIGRATION_STREAMS.upgrade] });

      const outcome = await service.applySegment(tx, segmentWith(upgradeStep({ height: 2552650 })));

      expect(outcome).toEqual({ upgradeApplied: true });
      expect(recorded.updates).toEqual([]);
    });

    it("drains until the computed totals equal the block's bank events, consuming closed slots along the way", async () => {
      const { service, tx, recorded, logger } = setup({
        queuePending: 2,
        queueSlots: [
          { position: 0, deploymentId: 12 },
          { position: 1, deploymentId: 11 }
        ],
        drainDeployments: [
          { id: 12, denom: "uakt", balance: "50", deposit: "50", withdrawnAmount: "0", blockRate: "0", closedHeight: 2552655 },
          { id: 11, denom: "uakt", balance: "100.5", deposit: "100", withdrawnAmount: "10", blockRate: "10", closedHeight: null }
        ],
        drainLeases: [{ deploymentId: 11, gseq: 1, oseq: 1, bseq: 0, providerAccountId: 7, price: "10", balance: "8", withdrawnAmount: "7" }],
        remainingAfter: 0
      });
      const step = drainStep({ height: 2552660, aktUsdRate: "0.5", bankTotals: { burnedUakt: 108n, burnedUsdc: 0n, mintedUact: 54n } });

      const outcome = await service.applySegment(tx, segmentWith(step));

      expect(outcome).toEqual({ queueRemaining: 0, drained: true });
      const deploymentUpdate = recorded.updates.find(update => update.table === Deployments);
      expect(deploymentUpdate?.set).toEqual({ denom: "uact", balance: "50.25", deposit: "50", withdrawnAmount: "5", blockRate: "5" });
      const leaseUpdate = recorded.updates.find(update => update.table === Leases);
      expect(leaseUpdate?.set).toEqual({ denom: "uact", price: "5", balance: "4", withdrawnAmount: "3" });
      const queueUpdate = recorded.updates.find(update => update.table === ActMigrationQueue);
      expect(queueUpdate?.set).toEqual({ convertedAtHeight: 2552660 });
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ACT_MIGRATION_DRAIN_APPLIED", converted: 1, skippedClosed: 1 }));
      expect(recorded.inserts.filter(insert => insert.table === IndexerState).map(insert => (insert.rows as Array<{ stream: string }>)[0].stream)).toEqual([
        ACT_MIGRATION_STREAMS.drainAt(2552660),
        ACT_MIGRATION_STREAMS.drained
      ]);
    });

    it("aborts the block when converting the next queue entry would overshoot the chain's totals", async () => {
      const { service, tx } = setup({
        queuePending: 1,
        queueSlots: [{ position: 0, deploymentId: 11 }],
        drainDeployments: [{ id: 11, denom: "uakt", balance: "100.5", deposit: "100", withdrawnAmount: "10", blockRate: "10", closedHeight: null }],
        drainLeases: []
      });
      const step = drainStep({ height: 2552660, aktUsdRate: "0.5", bankTotals: { burnedUakt: 50n, burnedUsdc: 0n, mintedUact: 25n } });

      await expect(service.applySegment(tx, segmentWith(step))).rejects.toThrow("overshoots the chain's totals");
    });

    it("reports a shortfall when the queue runs out before the chain's totals are reached", async () => {
      const { service, tx, logger } = setup({
        queuePending: 1,
        queueSlots: [{ position: 0, deploymentId: 11 }],
        drainDeployments: [{ id: 11, denom: "uakt", balance: "100.5", deposit: "100", withdrawnAmount: "10", blockRate: "10", closedHeight: null }],
        drainLeases: [],
        remainingAfter: 0,
        extraEmptySlotReads: 1
      });
      const step = drainStep({ height: 2552660, aktUsdRate: "0.5", bankTotals: { burnedUakt: 9034806372n, burnedUsdc: 0n, mintedUact: 5658593148n } });

      const outcome = await service.applySegment(tx, segmentWith(step));

      expect(outcome).toEqual({ queueRemaining: 0, drained: true });
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ACT_MIGRATION_DRAIN_SHORTFALL", converted: 1 }));
    });

    it("treats a conversion-signature block with an empty queue as already drained, even when mixed with ledger executions", async () => {
      const { service, tx, recorded } = setup({ queuePending: 0 });
      const step = { ...drainStep({ height: 30, aktUsdRate: "0.5", bankTotals: { burnedUakt: 9n, burnedUsdc: 0n, mintedUact: 5n } }), validatable: false };

      const outcome = await service.applySegment(tx, segmentWith(step));

      expect(outcome).toEqual({ queueRemaining: 0, drained: true });
      expect(recorded.updates).toEqual([]);
    });

    it("aborts when a block mixes ledger executions with an unfinished drain", async () => {
      const { service, tx } = setup({ queuePending: 5 });
      const step = { ...drainStep({ height: 30, aktUsdRate: "0.5", bankTotals: { burnedUakt: 9n, burnedUsdc: 0n, mintedUact: 5n } }), validatable: false };

      await expect(service.applySegment(tx, segmentWith(step))).rejects.toThrow("cannot bind the conversion boundary");
    });

    it("skips a drain height another writer already claimed without consuming queue slots", async () => {
      const { service, tx, recorded } = setup({ claimRejects: [ACT_MIGRATION_STREAMS.drainAt(2552660)] });

      const outcome = await service.applySegment(tx, segmentWith(drainStep({ height: 2552660, aktUsdRate: "0.5" })));

      expect(outcome).toBeNull();
      expect(recorded.updates).toEqual([]);
    });
  });

  function vaultFundedEvent(): DecodedEvent {
    return { type: "akash.bme.v1.EventVaultFunded", attributes: { amount: '{"denom":"uakt","amount":"1000"}' } };
  }

  function conversionBankEvents(burned: string, minted: string): DecodedEvent[] {
    return [
      { type: "burn", attributes: { burner: BME_MODULE_ADDRESS, amount: burned } },
      { type: "coinbase", attributes: { minter: BME_MODULE_ADDRESS, amount: minted } }
    ];
  }

  function priceEvent(price: string): DecodedEvent {
    return {
      type: "akash.oracle.v1.EventPriceData",
      attributes: { source: '"band"', id: '{"denom":"akt","base_denom":"usd"}', data: `{"price":"${price}","timestamp":"t"}` }
    };
  }

  function block(input: { height: number; txEvents?: DecodedEvent[]; blockEvents?: DecodedEvent[] }): DecodedBlock {
    return {
      height: input.height,
      datetime: BLOCK_TIME,
      hash: Buffer.alloc(0),
      parentHash: null,
      proposerAddress: "P",
      transactions: input.txEvents
        ? [
            {
              index: 0,
              hash: Buffer.alloc(0),
              code: 0,
              gasUsed: 0,
              gasWanted: 0,
              fee: [],
              messages: [],
              events: input.txEvents,
              signerAddresses: []
            }
          ]
        : [],
      blockEvents: input.blockEvents ?? []
    };
  }

  function planlessSegment(observations: { lastAktUsdPrice?: { price: string; height: number } }) {
    return {
      blocks: [block({ height: 20 })],
      step: null,
      observations: { lastAktUsdPrice: observations.lastAktUsdPrice ?? null }
    };
  }

  function segmentWith(step: Parameters<ActMigrationService["applySegment"]>[1]["step"]) {
    return { blocks: [block({ height: step?.height ?? 20 })], step, observations: { lastAktUsdPrice: null } };
  }

  function upgradeStep(input: { height: number; bankTotals?: { burnedUakt: bigint; burnedUsdc: bigint; mintedUact: bigint } }) {
    return {
      kind: "upgrade" as const,
      height: input.height,
      bankTotals: input.bankTotals ?? { burnedUakt: 0n, burnedUsdc: 0n, mintedUact: 0n },
      validatable: true
    };
  }

  function drainStep(input: { height: number; aktUsdRate: string; bankTotals?: { burnedUakt: bigint; burnedUsdc: bigint; mintedUact: bigint } }) {
    return {
      kind: "drain" as const,
      height: input.height,
      aktUsdRate: input.aktUsdRate,
      bankTotals: input.bankTotals ?? { burnedUakt: 0n, burnedUsdc: 0n, mintedUact: 0n },
      validatable: true
    };
  }

  function setup(input?: {
    markers?: Array<"upgrade" | "drained">;
    queuePending?: number;
    persistedPrice?: string;
    claimRejects?: string[];
    openDeployments?: Array<Record<string, unknown>>;
    detectionResources?: Array<Record<string, unknown>>;
    queueSlots?: Array<{ position: number; deploymentId: number }>;
    drainDeployments?: Array<Record<string, unknown>>;
    drainLeases?: Array<Record<string, unknown>>;
    remainingAfter?: number;
    extraEmptySlotReads?: number;
  }) {
    const markerRows = (input?.markers ?? []).map(kind => ({ stream: ACT_MIGRATION_STREAMS[kind] }));
    const stateRows = input?.persistedPrice === undefined ? [] : [{ id: 1, lastAktUsdPrice: input.persistedPrice, lastPriceHeight: 1 }];

    const dbFake = {
      select: () => ({
        from: (table: unknown) => {
          if (table === IndexerState) return query(markerRows);
          if (table === ActMigrationQueue) return query([{ remaining: input?.queuePending ?? 1 }]);
          if (table === ActMigrationState) return query(stateRows);
          return query([]);
        }
      })
    };

    const recorded = {
      inserts: [] as Array<{ table: unknown; rows: unknown }>,
      updates: [] as Array<{ table: unknown; set: Record<string, unknown>; where: unknown }>
    };
    const queueSelects: unknown[][] = [[{ remaining: input?.queuePending ?? 0 }]];
    if (input?.queueSlots) {
      queueSelects.push(input.queueSlots);
      for (let i = 0; i < (input?.extraEmptySlotReads ?? 0); i++) {
        queueSelects.push([]);
      }
      queueSelects.push([{ remaining: input?.remainingAfter ?? 0 }]);
    }
    const txSelects = new Map<unknown, unknown[][]>([
      [ActMigrationQueue, queueSelects],
      [Deployments, [input?.openDeployments ?? input?.drainDeployments ?? []]],
      [Leases, [input?.drainLeases ?? [], [], []]],
      [DeploymentGroupResourcesToken, [input?.detectionResources ?? [], [], [], [], []]]
    ]);

    const txFake = {
      select: () => ({
        from: (table: unknown) => {
          const key = txSelects.has(table) ? table : DeploymentGroupResourcesToken;
          const queues = txSelects.get(key);
          const rows = queues && queues.length > 0 ? queues.shift() : [];
          return query(rows ?? []);
        }
      }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          recorded.inserts.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
          const claimStream = table === IndexerState && !Array.isArray(rows) ? (rows as { stream: string }).stream : null;
          const claimResult = claimStream !== null && input?.claimRejects?.includes(claimStream) ? [] : [rows];
          return Object.assign(Promise.resolve(), {
            onConflictDoNothing: () => ({ returning: () => Promise.resolve(claimResult) }),
            onConflictDoUpdate: () => Promise.resolve()
          });
        }
      }),
      update: (table: unknown) => ({
        set: (set: Record<string, unknown>) => ({
          where: (where: unknown) => {
            recorded.updates.push({ table, set, where });
            return Object.assign(Promise.resolve(), { returning: () => Promise.resolve([]) });
          }
        })
      })
    };

    const logger = mock<LoggerService>();
    const service = new ActMigrationService(dbFake as unknown as ChainDatabase, logger);
    return { service, logger, tx: txFake as unknown as ChainTransaction, recorded };
  }

  const DeploymentGroupResourcesToken = Symbol("group_resources");

  function query(rows: unknown) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      innerJoin: self,
      where: self,
      orderBy: self,
      limit: self,
      for: self,
      then: (resolve: (rows: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject)
    });
    return chain;
  }
});
