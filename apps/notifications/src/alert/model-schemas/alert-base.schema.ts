import { sql } from 'drizzle-orm';
import { jsonb, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from '@src/lib/db/timestamps';
import { ContactPoint } from './contact-point.schema';

export const getAlertBaseFields = () => ({
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid('user_id').unique(),
  contactPointId: uuid('contact_point_id').references(() => ContactPoint.id),
  template: text('template').notNull(),
  conditions: jsonb('conditions').notNull(),

  ...timestamps,
});
