import { asc, isNull } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { type FundingFreeze, fundingFreezes } from "@src/model-schemas";
import { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";

@singleton()
export class FundingFreezeRepository {
  constructor(@inject(FundingControlsDatabase) private readonly database: FundingControlsDatabase) {}

  async findActive(): Promise<FundingFreeze | undefined> {
    const [freeze] = await this.database.orm
      .select()
      .from(fundingFreezes)
      .where(isNull(fundingFreezes.liftedAt))
      .orderBy(asc(fundingFreezes.frozenAt))
      .limit(1);

    return freeze;
  }

  async create(input: { reason: string; frozenBy: string }): Promise<FundingFreeze> {
    const [freeze] = await this.database.orm.insert(fundingFreezes).values(input).returning();

    return freeze;
  }

  /** Lifts every freeze still standing, since two operators freezing at the same moment leave two rows. */
  async liftActive(input: { liftedBy: string }): Promise<FundingFreeze[]> {
    return await this.database.orm
      .update(fundingFreezes)
      .set({ liftedBy: input.liftedBy, liftedAt: new Date() })
      .where(isNull(fundingFreezes.liftedAt))
      .returning();
  }
}
