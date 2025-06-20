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
import * as schema from "../../model-schemas";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];
export const notificationChannelConfigSchema = z.object({
  addresses: z.array(z.string().email())
});

export type NotificationChannelConfig = z.infer<typeof notificationChannelConfigSchema>;

type InternalNotificationChannelInput = typeof schema.NotificationChannel.$inferInsert;
export type NotificationChannelInput = Omit<InternalNotificationChannelInput, "config"> & {
  config: NotificationChannelConfig;
};

type InternalNotificationChannelOutput = typeof schema.NotificationChannel.$inferSelect;
export type NotificationChannelOutput = Omit<InternalNotificationChannelOutput, "config"> & {
  config: NotificationChannelConfig;
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
export class NotificationChannelRepository {
  id = randomUUID();
  protected ability?: DrizzleAbility<typeof schema.NotificationChannel>;

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  accessibleBy(...abilityParams: AbilityParams) {
    return new NotificationChannelRepository(this.db).withAbility(...abilityParams) as this;
  }

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(schema.NotificationChannel, ability, action, "NotificationChannel");

    return this;
  }

  protected whereAccessibleBy(where?: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  async findById(id: NotificationChannelOutput["id"]): Promise<NotificationChannelOutput | undefined> {
    const notificationChannel = await this.db.query.NotificationChannel.findFirst({
      where: eq(schema.NotificationChannel.id, id)
    });

    return notificationChannel && this.toOutput(notificationChannel);
  }

  async paginate(options: PaginateOptions): Promise<PaginatedResult<NotificationChannelOutput>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const where = this.whereAccessibleBy();

    const notificationChannels = await this.db.query.NotificationChannel.findMany({
      where,
      limit,
      offset,
      orderBy: schema.NotificationChannel.createdAt
    });

    const countResult = await this.db
      .select({ count: count(schema.NotificationChannel.id) })
      .from(schema.NotificationChannel)
      .where(where);

    const total = Number(countResult[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: this.toOutputList(notificationChannels),
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

  async create(input: NotificationChannelInput): Promise<NotificationChannelOutput> {
    this.ability?.throwUnlessCanExecute(input);

    const [result] = await this.db.insert(schema.NotificationChannel).values(this.toInput(input)).returning();

    return this.toOutput(result);
  }

  async updateById(id: string, input: Partial<NotificationChannelInput>): Promise<NotificationChannelOutput | undefined> {
    const [notificationChannel] = await this.db
      .update(schema.NotificationChannel)
      .set(this.toInput(input))
      .where(this.whereAccessibleBy(eq(schema.NotificationChannel.id, id)))
      .returning();

    return notificationChannel && this.toOutput(notificationChannel);
  }

  async deleteById(id: string): Promise<NotificationChannelOutput | undefined> {
    const [notificationChannel] = await this.db
      .delete(schema.NotificationChannel)
      .where(this.whereAccessibleBy(eq(schema.NotificationChannel.id, id)))
      .returning();

    return notificationChannel && this.toOutput(notificationChannel);
  }

  private toInput<T extends Partial<InternalNotificationChannelInput>>(alert: T): T {
    if (alert.config) {
      return {
        ...alert,
        config: notificationChannelConfigSchema.parse(alert.config)
      };
    }

    return alert;
  }

  private toOutputList(notificationChannels: InternalNotificationChannelOutput[]): NotificationChannelOutput[] {
    return notificationChannels.map(notificationChannel => this.toOutput(notificationChannel));
  }

  private toOutput(notificationChannel: InternalNotificationChannelOutput): NotificationChannelOutput {
    return {
      ...notificationChannel,
      config: notificationChannelConfigSchema.parse(notificationChannel.config)
    };
  }
}
