import { InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';

import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import * as schema from '../../model-schemas';

export const contactPointConfigSchema = z.object({
  addresses: z.array(z.string().email()),
});

export type ContactPointConfig = z.infer<typeof contactPointConfigSchema>;

type InternalContactPointInput = typeof schema.ContactPoint.$inferInsert;
export type ContactPointInput = Omit<InternalContactPointInput, 'config'> & {
  config: ContactPointConfig;
};

type InternalContactPointOutput = typeof schema.ContactPoint.$inferSelect;
export type ContactPointOutput = Omit<InternalContactPointOutput, 'config'> & {
  config: ContactPointConfig;
};

@Injectable()
export class ContactPointRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(
    id: ContactPointOutput['id'],
  ): Promise<ContactPointOutput | undefined> {
    const contactPoint = await this.db.query.ContactPoint.findFirst({
      where: eq(schema.ContactPoint.id, id),
    });

    return contactPoint && this.toOutput(contactPoint);
  }

  async create(input: ContactPointInput): Promise<ContactPointOutput> {
    const [result] = await this.db
      .insert(schema.ContactPoint)
      .values(this.toInput(input))
      .returning();

    return this.toOutput(result);
  }

  async updateById(
    id: string,
    input: Partial<ContactPointInput>,
  ): Promise<ContactPointOutput | undefined> {
    const [contactPoint] = await this.db
      .update(schema.ContactPoint)
      .set(this.toInput(input))
      .where(eq(schema.ContactPoint.id, id))
      .returning();

    return contactPoint && this.toOutput(contactPoint);
  }

  async deleteById(id: string): Promise<ContactPointOutput | undefined> {
    const [contactPoint] = await this.db
      .delete(schema.ContactPoint)
      .where(eq(schema.ContactPoint.id, id))
      .returning();

    return contactPoint && this.toOutput(contactPoint);
  }

  private toInput<T extends Partial<InternalContactPointInput>>(alert: T): T {
    if (alert.config) {
      return {
        ...alert,
        config: contactPointConfigSchema.parse(alert.config),
      };
    }

    return alert;
  }

  private toOutput(
    contactPoint: InternalContactPointOutput,
  ): ContactPointOutput {
    return {
      ...contactPoint,
      config: contactPointConfigSchema.parse(contactPoint.config),
    };
  }
}
