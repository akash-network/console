import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { type HardwareRequestLane, HardwareRequests, type HardwareRequestStatus } from "../hardware-request/hardware-request.schema";

export const MAX_ACTOR_LENGTH = 100;

export const CLOSE_REASONS = ["no_supply", "price", "went_silent", "duplicate", "other"] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

export const hardwareRequestEventTypeEnum = pgEnum("hardware_request_event_type", [
  "created_on_behalf",
  "status_changed",
  "owner_changed",
  "lane_changed",
  "note",
  "offer_published",
  "offer_withdrawn",
  "offer_accepted",
  "offer_declined",
  "approval_requested",
  "reminder_sent",
  "escalated"
]);

export type HardwareRequestEventType = (typeof hardwareRequestEventTypeEnum.enumValues)[number];

export type HardwareRequestEventPayloads = {
  created_on_behalf: { organizationId: string | null; email: string | null };
  status_changed: { from: HardwareRequestStatus; to: HardwareRequestStatus; closeReason?: CloseReason; userId?: string };
  owner_changed: { from: string | null; to: string | null };
  lane_changed: { from: HardwareRequestLane | null; to: HardwareRequestLane };
  note: { text: string };
  offer_published: { offerId: string };
  offer_withdrawn: { offerId: string };
  offer_accepted: { offerId: string; userId: string };
  offer_declined: { offerId: string; userId: string };
  approval_requested: { offerId: string; userId: string };
  reminder_sent: { target: string };
  escalated: { target: string };
};

export const HardwareRequestEvents = pgTable(
  "hardware_request_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    hardwareRequestId: uuid("hardware_request_id")
      .references(() => HardwareRequests.id, { onDelete: "cascade" })
      .notNull(),
    type: hardwareRequestEventTypeEnum("type").notNull(),
    actor: varchar("actor", { length: MAX_ACTOR_LENGTH }),
    payload: jsonb("payload").$type<HardwareRequestEventPayloads[HardwareRequestEventType]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    hardwareRequestIdCreatedAtIdx: index("hardware_request_events_hardware_request_id_created_at_idx").on(table.hardwareRequestId, table.createdAt)
  })
);
