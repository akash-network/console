import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { MoveUserToActiveFundingWalletHandler } from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.handler";
import { MoveUserToActiveFundingWallet } from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.job";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB } from "@src/core";
import { TxService } from "@src/core/services";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FundingWalletMoveQueueService } from "./funding-wallet-move-queue.service";

import { deleteQueuedJobs, useJobWorkers } from "@test/services/job-queue-harness";

const MOVE = MoveUserToActiveFundingWallet[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(MoveUserToActiveFundingWalletHandler)]);

describe(FundingWalletMoveQueueService.name, () => {
  afterEach(async () => {
    await deleteQueuedJobs(MOVE);
  });

  it("queues a move that waits for its start time", async () => {
    const { service, network, userWalletId, findMoves } = await setup();

    await service.queue({ network, userWalletId, priority: 1, startAfter: new Date(Date.now() + 10 * 60_000) });

    await expect(findMoves()).resolves.toEqual([{ state: "created", priority: 1, userWalletId, isDue: false }]);
  });

  it("replaces the queued move of a user wallet with one that is due now and runs before the others", async () => {
    const { service, network, userWalletId, findMoves } = await setup();
    await service.queue({ network, userWalletId, priority: 0, startAfter: new Date(Date.now() + 10 * 60_000) });

    await service.queueAheadOfOthers(network, userWalletId);
    await service.queueAheadOfOthers(network, userWalletId);

    const moves = await findMoves();
    expect(moves.filter(move => move.state === "created")).toEqual([{ state: "created", priority: 2, userWalletId, isDue: true }]);
    expect(moves.filter(move => move.state === "cancelled")).toHaveLength(2);
  });

  it("leaves the queued moves of other user wallets as they are", async () => {
    const { service, network, userWalletId, findMoves } = await setup();
    const other = userWalletId + 1;
    await service.queue({ network, userWalletId: other, priority: 0, startAfter: new Date(Date.now() + 10 * 60_000) });

    await service.queueAheadOfOthers(network, userWalletId);

    await expect(findMoves(other)).resolves.toEqual([{ state: "created", priority: 0, userWalletId: other, isDue: false }]);
  });

  it("keeps the move queued when the transaction it was asked from rolls back", async () => {
    const { service, network, userWalletId, findMoves } = await setup();
    const refusal = new Error("refused");

    await expect(
      container.resolve(TxService).transaction(async () => {
        await service.queueAheadOfOthers(network, userWalletId);
        throw refusal;
      })
    ).rejects.toBe(refusal);

    await expect(findMoves()).resolves.toEqual([{ state: "created", priority: 2, userWalletId, isDue: true }]);
  });

  async function setup() {
    await jobWorkers();
    const network = `net-${faker.string.alphanumeric(12)}`;
    const userWalletId = faker.number.int({ min: 1, max: 1_000_000 });
    const jobTable = sql`${sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"))}.job`;

    const findMoves = async (id = userWalletId) => {
      const rows = await container.resolve<ApiPgDatabase>(POSTGRES_DB).execute(
        sql`select state::text, priority, (data->>'userWalletId')::int as "userWalletId", start_after <= now() + interval '1 second' as "isDue"
            from ${jobTable} where name = ${MOVE} and singleton_key = ${`${network}.${id}`} order by created_on`
      );

      return rows as unknown as { state: string; priority: number; userWalletId: number; isDue: boolean }[];
    };

    return { service: container.resolve(FundingWalletMoveQueueService), network, userWalletId, findMoves };
  }
});
