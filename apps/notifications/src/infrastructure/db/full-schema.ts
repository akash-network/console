import type * as alertSchema from "@src/modules/alert/model-schemas";
import type * as notificationsSchema from "@src/modules/notifications/model-schemas";

/**
 * Type-only intersection of every module's Drizzle schema. Use as the generic
 * for `NodePgDatabase<FullSchema>` when a service or controller needs to start
 * a transaction that spans more than one module's repositories.
 */
export type FullSchema = typeof alertSchema & typeof notificationsSchema;
