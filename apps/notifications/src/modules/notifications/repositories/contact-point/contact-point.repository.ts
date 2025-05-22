import type { AnyAbility } from "@casl/ability";
import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { count, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm/sql/sql";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";
import { AbilityParams } from "@src/modules/alert/repositories/alert/alert.repository";
import * as schema from "../../model-schemas";

export const contactPointConfigSchema = z.object({
  addresses: z.array(z.string().email())
});

export type ContactPointConfig = z.infer<typeof contactPointConfigSchema>;

type InternalContactPointInput = typeof schema.ContactPoint.$inferInsert;
export type ContactPointInput = Omit<InternalContactPointInput, "config"> & {
  config: ContactPointConfig;
};

type InternalContactPointOutput = typeof schema.ContactPoint.$inferSelect;
export type ContactPointOutput = Omit<InternalContactPointOutput, "config"> & {
  config: ContactPointConfig;
};

export type PaginateOptions = {
  limit?: number;
  page?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

@Injectable()
export class ContactPointRepository {
  id = randomUUID();
  protected ability?: DrizzleAbility<typeof schema.ContactPoint>;

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  accessibleBy(...abilityParams: AbilityParams) {
    return new ContactPointRepository(this.db).withAbility(...abilityParams) as this;
  }

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(schema.ContactPoint, ability, action, "ContactPoint");

    return this;
  }

  protected whereAccessibleBy(where?: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  async findById(id: ContactPointOutput["id"]): Promise<ContactPointOutput | undefined> {
    const contactPoint = await this.db.query.ContactPoint.findFirst({
      where: eq(schema.ContactPoint.id, id)
    });

    return contactPoint && this.toOutput(contactPoint);
  }

  async paginate(options: PaginateOptions): Promise<PaginatedResult<ContactPointOutput>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const where = this.whereAccessibleBy();

    const contactPoints = await this.db.query.ContactPoint.findMany({
      where,
      limit,
      offset,
      orderBy: schema.ContactPoint.createdAt
    });

    const countResult = await this.db
      .select({ count: count(schema.ContactPoint.id) })
      .from(schema.ContactPoint)
      .where(where);

    const total = Number(countResult[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: this.toOutputList(contactPoints),
      pagination: {
        total,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async create(input: ContactPointInput): Promise<ContactPointOutput> {
    this.ability?.throwUnlessCanExecute(input);

    const [result] = await this.db.insert(schema.ContactPoint).values(this.toInput(input)).returning();

    return this.toOutput(result);
  }

  async updateById(id: string, input: Partial<ContactPointInput>): Promise<ContactPointOutput | undefined> {
    const [contactPoint] = await this.db
      .update(schema.ContactPoint)
      .set(this.toInput(input))
      .where(this.whereAccessibleBy(eq(schema.ContactPoint.id, id)))
      .returning();

    return contactPoint && this.toOutput(contactPoint);
  }

  async deleteById(id: string): Promise<ContactPointOutput | undefined> {
    const [contactPoint] = await this.db
      .delete(schema.ContactPoint)
      .where(this.whereAccessibleBy(eq(schema.ContactPoint.id, id)))
      .returning();

    return contactPoint && this.toOutput(contactPoint);
  }

  private toInput<T extends Partial<InternalContactPointInput>>(alert: T): T {
    if (alert.config) {
      return {
        ...alert,
        config: contactPointConfigSchema.parse(alert.config)
      };
    }

    return alert;
  }

  private toOutputList(contactPoints: InternalContactPointOutput[]): ContactPointOutput[] {
    return contactPoints.map(contactPoint => this.toOutput(contactPoint));
  }

  private toOutput(contactPoint: InternalContactPointOutput): ContactPointOutput {
    return {
      ...contactPoint,
      config: contactPointConfigSchema.parse(contactPoint.config)
    };
  }
}
