import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { IndexerState } from "@src/db/schema";
import type { AccountSeeder } from "@src/genesis/account-seeder.service";
import type { BankSeeder } from "@src/genesis/bank-seeder.service";
import { GenesisImportService } from "@src/genesis/genesis-import.service";
import { GenesisMidChainError } from "@src/genesis/genesis-mid-chain-error";
import type { GenesisSource } from "@src/genesis/genesis-source";
import type { StakingSeeder } from "@src/genesis/staking-seeder.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

import { buildParsedGenesis } from "@test/fakes/genesis-fixtures";

describe(GenesisImportService.name, () => {
  it("rejects a fresh start that is not at the genesis height", async () => {
    const { service, accountSeeder } = setup();

    await expect(service.ensureSeeded(500)).rejects.toBeInstanceOf(GenesisMidChainError);
    expect(accountSeeder.intern).not.toHaveBeenCalled();
  });

  it("skips seeding when the genesis marker already exists", async () => {
    const { service, accountSeeder, bankSeeder, stakingSeeder } = setup({ existingMarker: true });

    await service.ensureSeeded(1);

    expect(accountSeeder.intern).not.toHaveBeenCalled();
    expect(bankSeeder.seed).not.toHaveBeenCalled();
    expect(stakingSeeder.seed).not.toHaveBeenCalled();
  });

  it("seeds all modules in one transaction and claims the marker at the genesis height", async () => {
    const { service, accountSeeder, bankSeeder, stakingSeeder, markerInserts } = setup();

    await service.ensureSeeded(1);

    expect(accountSeeder.intern).toHaveBeenCalledTimes(1);
    expect(bankSeeder.seed).toHaveBeenCalledTimes(1);
    expect(stakingSeeder.seed).toHaveBeenCalledTimes(1);
    expect(markerInserts).toEqual([expect.objectContaining({ stream: "genesis", lastHeight: 1 })]);
  });

  it("still seeds when the genesis has unmodeled account types", async () => {
    const { service, source, accountSeeder } = setup();
    source.fetchGenesis.mockResolvedValue({ ...buildParsedGenesis(), unknownAccountTypes: ["/cosmos.auth.v1beta1.SomethingNew"] });

    await service.ensureSeeded(1);

    expect(accountSeeder.intern).toHaveBeenCalledTimes(1);
  });

  it("does not seed when another writer claimed the marker first", async () => {
    const { service, accountSeeder, bankSeeder } = setup({ claimReturnsEmpty: true });

    await service.ensureSeeded(1);

    expect(accountSeeder.intern).not.toHaveBeenCalled();
    expect(bankSeeder.seed).not.toHaveBeenCalled();
  });

  function setup(input?: { existingMarker?: boolean; claimReturnsEmpty?: boolean }) {
    const source = mock<GenesisSource>();
    source.fetchGenesis.mockResolvedValue(buildParsedGenesis());

    const accountSeeder = mock<AccountSeeder>();
    accountSeeder.intern.mockResolvedValue(new Map([["akash1base", 1]]));
    const bankSeeder = mock<BankSeeder>();
    const stakingSeeder = mock<StakingSeeder>();

    const markerInserts: Record<string, unknown>[] = [];
    const txFake = {
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          if (table === IndexerState) {
            markerInserts.push(row);
          }
          return { onConflictDoNothing: () => ({ returning: () => Promise.resolve(input?.claimReturnsEmpty ? [] : [row]) }) };
        }
      })
    };

    const dbFake = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(input?.existingMarker ? [{ stream: "genesis", lastHeight: 1 }] : []) }) }),
      transaction: (callback: (tx: unknown) => Promise<void>) => callback(txFake)
    };

    const service = new GenesisImportService(dbFake as unknown as ChainDatabase, source, accountSeeder, bankSeeder, stakingSeeder, mock<LoggerService>());
    return { service, source, accountSeeder, bankSeeder, stakingSeeder, markerInserts };
  }
});
