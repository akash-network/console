import { sql } from 'drizzle-orm';
import { jsonb, pgEnum, pgTable, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from '@src/lib/db/timestamps';

export const ContactPointType = pgEnum('contact_point_type', ['email']);

export const ContactPoint = pgTable('contact_points', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid('user_id').notNull().unique(),
  type: ContactPointType('type').notNull(),
  config: jsonb('config').notNull(),

  ...timestamps,
});
