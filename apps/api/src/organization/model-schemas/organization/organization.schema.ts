import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// eslint-disable-next-line import-x/no-cycle
import { Users } from "@src/user/model-schemas/user/user.schema";

export const organizationTypeEnum = pgEnum("organization_type", ["personal", "team"]);

export type OrganizationType = (typeof organizationTypeEnum.enumValues)[number];

export const MAX_ORGANIZATION_NAME_LENGTH = 64;
export const MAX_ORGANIZATION_SLUG_LENGTH = 64;

export const Organizations = pgTable(
  "organizations",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    name: varchar("name", { length: MAX_ORGANIZATION_NAME_LENGTH }).notNull(),
    slug: varchar("slug", { length: MAX_ORGANIZATION_SLUG_LENGTH }).notNull().unique(),
    type: organizationTypeEnum("type").notNull(),
    /** Not unique yet: accounts created before organizations existed may share a Stripe customer. */
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    createdByUserId: uuid("created_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    stripeCustomerIdIdx: index("organizations_stripe_customer_id_idx").on(table.stripeCustomerId),
    /** Covers soft-deleted rows on purpose, so a user can never end up with two personal organizations. */
    personalCreatedByUserIdUnique: uniqueIndex("organizations_personal_created_by_user_id_unique")
      .on(table.createdByUserId)
      .where(sql`${table.type} = 'personal'`)
  })
);
