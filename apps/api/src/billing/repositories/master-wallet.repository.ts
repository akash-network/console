import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { MasterWallets } from "@src/billing/model-schemas/master-wallet/master-wallet.schema";
import type { MasterWalletCategory } from "@src/billing/types/wallet.type";
import type { ApiPgDatabase } from "@src/core/providers/postgres.provider";
import { InjectPg } from "@src/core/providers/postgres.provider";

export interface CreateMasterWalletInput {
  address: string;
  category: MasterWalletCategory;
}

export interface MasterWalletOutput {
  id: number;
  address: string;
  category: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

@singleton()
export class MasterWalletRepository {
  constructor(@InjectPg() private readonly pg: ApiPgDatabase) {}

  async create(input: CreateMasterWalletInput): Promise<MasterWalletOutput> {
    const [masterWallet] = await this.pg.insert(MasterWallets).values(input).returning();

    return masterWallet;
  }

  async findByCategory(category: MasterWalletCategory): Promise<MasterWalletOutput | null> {
    const masterWallet = await this.pg.select().from(MasterWallets).where(eq(MasterWallets.category, category)).limit(1);

    return masterWallet[0] || null;
  }

  async findByAddress(address: string): Promise<MasterWalletOutput | null> {
    const masterWallet = await this.pg.select().from(MasterWallets).where(eq(MasterWallets.address, address)).limit(1);

    return masterWallet[0] || null;
  }

  async findById(id: number): Promise<MasterWalletOutput | null> {
    const masterWallet = await this.pg.select().from(MasterWallets).where(eq(MasterWallets.id, id)).limit(1);

    return masterWallet[0] || null;
  }

  async findAll(): Promise<MasterWalletOutput[]> {
    return await this.pg.select().from(MasterWallets);
  }

  async update(id: number, input: Partial<CreateMasterWalletInput>): Promise<MasterWalletOutput | null> {
    const [masterWallet] = await this.pg
      .update(MasterWallets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(MasterWallets.id, id))
      .returning();

    return masterWallet || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pg.delete(MasterWallets).where(eq(MasterWallets.id, id));

    return result.length > 0;
  }
}
