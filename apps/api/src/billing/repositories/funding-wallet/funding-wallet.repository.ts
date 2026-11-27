import { and, eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type FundingWalletsTable = ApiPgTables["FundingWallets"];
type UserWalletGrantersTable = ApiPgTables["UserWalletGranters"];
type UserWalletsTable = ApiPgTables["UserWallets"];

export type FundingWalletOutput = Pick<FundingWalletsTable["$inferSelect"], "id" | "network" | "address" | "status">;

export type FundingWalletInput = Pick<FundingWalletsTable["$inferInsert"], "network" | "address" | "status">;

export type GranterAssignment = { userWalletId: number; network: string; fundingWalletId: string };

@singleton()
export class FundingWalletRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("FundingWallets") private readonly table: FundingWalletsTable,
    @InjectPgTable("UserWalletGranters") private readonly granters: UserWalletGrantersTable,
    @InjectPgTable("UserWallets") private readonly userWallets: UserWalletsTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  get #fields() {
    return { id: this.table.id, network: this.table.network, address: this.table.address, status: this.table.status };
  }

  async findActive(network: string): Promise<FundingWalletOutput | undefined> {
    const [wallet] = await this.#cursor
      .select(this.#fields)
      .from(this.table)
      .where(and(eq(this.table.network, network), eq(this.table.status, "active")));

    return wallet;
  }

  /** One read tells whether the network has an active wallet and, failing that, whether it has any, so the two answers come from the same snapshot. */
  async findActiveOrAny(network: string): Promise<FundingWalletOutput | undefined> {
    const [wallet] = await this.#cursor
      .select(this.#fields)
      .from(this.table)
      .where(eq(this.table.network, network))
      .orderBy(sql`(${this.table.status} = 'active') DESC`)
      .limit(1);

    return wallet;
  }

  async create(input: FundingWalletInput): Promise<FundingWalletOutput> {
    const [wallet] = await this.#cursor.insert(this.table).values(input).returning(this.#fields);

    return wallet;
  }

  async findGranterOf(userWalletId: number, network: string): Promise<FundingWalletOutput | undefined> {
    const [wallet] = await this.#cursor
      .select(this.#fields)
      .from(this.granters)
      .innerJoin(this.table, eq(this.table.id, this.granters.fundingWalletId))
      .where(and(eq(this.granters.userWalletId, userWalletId), eq(this.granters.network, network)));

    return wallet;
  }

  async findGranterOfAddress(userWalletAddress: string, network: string): Promise<FundingWalletOutput | undefined> {
    const [wallet] = await this.#cursor
      .select(this.#fields)
      .from(this.granters)
      .innerJoin(this.table, eq(this.table.id, this.granters.fundingWalletId))
      .innerJoin(this.userWallets, eq(this.userWallets.id, this.granters.userWalletId))
      .where(and(eq(this.userWallets.address, userWalletAddress), eq(this.granters.network, network)));

    return wallet;
  }

  /** Keeps the granter a user wallet already has, because its balance sits on that funding wallet's grant. */
  async assignUnlessAssigned(assignment: GranterAssignment): Promise<void> {
    await this.#cursor
      .insert(this.granters)
      .values(assignment)
      .onConflictDoNothing({ target: [this.granters.userWalletId, this.granters.network] });
  }

  /** Covers every user wallet with an address, since any of them may already hold a grant from the network's first funding wallet. */
  async assignInitializedUserWallets({ network, fundingWalletId }: Omit<GranterAssignment, "userWalletId">): Promise<void> {
    await this.#cursor.execute(sql`
      INSERT INTO ${this.granters} (
        ${sql.identifier(this.granters.userWalletId.name)},
        ${sql.identifier(this.granters.network.name)},
        ${sql.identifier(this.granters.fundingWalletId.name)}
      )
      SELECT ${this.userWallets.id}, ${network}::varchar, ${fundingWalletId}::uuid
      FROM ${this.userWallets}
      WHERE ${this.userWallets.address} IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  }

  /** Held until the surrounding transaction ends, so two processes registering a network's first funding wallet take turns. */
  async lockNetwork(network: string): Promise<void> {
    await this.#cursor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`funding_wallets:${network}`}))`);
  }
}
