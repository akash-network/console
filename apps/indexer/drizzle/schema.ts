import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const deploymentGroup = pgTable(
  "deploymentGroup",
  {
    id: uuid().primaryKey().notNull(),
    deploymentId: uuid().notNull(),
    owner: varchar({ length: 255 }).notNull(),
    dseq: varchar({ length: 255 }).notNull(),
    gseq: integer().notNull()
  },
  table => [
    index("deployment_group_owner_dseq_gseq").using(
      "btree",
      table.owner.asc().nullsLast().op("text_ops"),
      table.dseq.asc().nullsLast().op("text_ops"),
      table.gseq.asc().nullsLast().op("int4_ops")
    ),
    index("deployment_group_deployment_id").using("btree", table.deploymentId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
      columns: [table.deploymentId],
      foreignColumns: [deployment.id],
      name: "deploymentGroup_deploymentId_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const bid = pgTable(
  "bid",
  {
    id: serial().primaryKey().notNull(),
    owner: varchar({ length: 255 }).notNull(),
    dseq: varchar({ length: 255 }).notNull(),
    gseq: integer().notNull(),
    oseq: integer().notNull(),
    bseq: integer().default(0).notNull(),
    provider: varchar({ length: 255 }).notNull(),
    price: doublePrecision().notNull(),
    createdHeight: integer().notNull()
  },
  table => [
    index("bid_owner_dseq_gseq_oseq_provider_bseq").using(
      "btree",
      table.owner.asc().nullsLast().op("text_ops"),
      table.dseq.asc().nullsLast().op("text_ops"),
      table.gseq.asc().nullsLast().op("int4_ops"),
      table.oseq.asc().nullsLast().op("int4_ops"),
      table.provider.asc().nullsLast().op("text_ops"),
      table.bseq.asc().nullsLast().op("int4_ops")
    )
  ]
);

export const providerAttributeSignature = pgTable(
  "providerAttributeSignature",
  {
    id: serial().primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    auditor: varchar({ length: 255 }).notNull(),
    key: varchar({ length: 255 }).notNull(),
    value: varchar({ length: 255 }).notNull()
  },
  table => [
    index("provider_attribute_signature_provider").using("btree", table.provider.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.provider],
      foreignColumns: [provider.owner],
      name: "providerAttributeSignature_provider_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const day = pgTable(
  "day",
  {
    id: uuid().primaryKey().notNull(),
    date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    aktPrice: doublePrecision(),
    firstBlockHeight: integer().notNull(),
    lastBlockHeight: integer(),
    lastBlockHeightYet: integer().notNull(),
    aktPriceChanged: boolean().default(true).notNull()
  },
  table => [
    uniqueIndex("day_date").using("btree", table.date.asc().nullsLast().op("timestamptz_ops")),
    uniqueIndex("day_first_block_height").using("btree", table.firstBlockHeight.asc().nullsLast().op("int4_ops")),
    uniqueIndex("day_last_block_height").using("btree", table.lastBlockHeight.asc().nullsLast().op("int4_ops"))
  ]
);

export const lease = pgTable(
  "lease",
  {
    id: uuid().primaryKey().notNull(),
    deploymentId: uuid().notNull(),
    deploymentGroupId: uuid().notNull(),
    owner: varchar({ length: 255 }).notNull(),
    dseq: varchar({ length: 255 }).notNull(),
    oseq: integer().notNull(),
    gseq: integer().notNull(),
    bseq: integer().default(0).notNull(),
    providerAddress: varchar({ length: 255 }).notNull(),
    createdHeight: integer().notNull(),
    closedHeight: integer(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    predictedClosedHeight: bigint({ mode: "number" }).notNull(),
    price: doublePrecision().notNull(),
    withdrawnAmount: doublePrecision()
      .default(sql`'0'`)
      .notNull(),
    denom: varchar({ length: 255 }).notNull(),
    cpuUnits: integer().notNull(),
    gpuUnits: integer().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    memoryQuantity: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    ephemeralStorageQuantity: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    persistentStorageQuantity: bigint({ mode: "number" }).notNull()
  },
  table => [
    index("lease_closed_height").using("btree", table.closedHeight.asc().nullsLast().op("int4_ops")),
    index("lease_deployment_id").using("btree", table.deploymentId.asc().nullsLast().op("uuid_ops")),
    uniqueIndex("lease_owner_dseq_gseq_oseq_provider_bseq").using(
      "btree",
      table.owner.asc().nullsLast().op("text_ops"),
      table.dseq.asc().nullsLast().op("text_ops"),
      table.gseq.asc().nullsLast().op("int4_ops"),
      table.oseq.asc().nullsLast().op("int4_ops"),
      table.providerAddress.asc().nullsLast().op("text_ops"),
      table.bseq.asc().nullsLast().op("int4_ops")
    ),
    index("lease_predicted_closed_height").using("btree", table.predictedClosedHeight.asc().nullsLast().op("int8_ops")),
    index("lease_provider_address_closed_height_created_height")
      .using(
        "btree",
        table.providerAddress.asc().nullsLast().op("text_ops"),
        table.closedHeight.asc().nullsLast().op("int4_ops"),
        table.createdHeight.asc().nullsLast().op("int4_ops")
      )
      .with({ deduplicate_items: "true" }),
    foreignKey({
      columns: [table.deploymentGroupId],
      foreignColumns: [deploymentGroup.id],
      name: "lease_deploymentGroupId_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.deploymentId],
      foreignColumns: [deployment.id],
      name: "lease_deploymentId_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.providerAddress],
      foreignColumns: [provider.owner],
      name: "lease_providerAddress_fkey"
    }).onUpdate("cascade")
  ]
);

export const deployment = pgTable(
  "deployment",
  {
    id: uuid().primaryKey().notNull(),
    owner: varchar({ length: 255 }).notNull(),
    dseq: varchar({ length: 255 }).notNull(),
    createdHeight: integer().notNull(),
    balance: doublePrecision().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    deposit: bigint({ mode: "number" }).notNull(),
    denom: varchar({ length: 255 }).notNull(),
    lastWithdrawHeight: integer(),
    withdrawnAmount: doublePrecision().notNull(),
    closedHeight: integer()
  },
  table => [
    index("deployment_created_height_closed_height").using(
      "btree",
      table.createdHeight.asc().nullsLast().op("int4_ops"),
      table.closedHeight.asc().nullsLast().op("int4_ops")
    ),
    index("deployment_owner").using("btree", table.owner.asc().nullsLast().op("text_ops"))
  ]
);

export const provider = pgTable(
  "provider",
  {
    owner: varchar({ length: 255 }).primaryKey().notNull(),
    hostUri: varchar({ length: 255 }).notNull(),
    createdHeight: integer().notNull(),
    deletedHeight: integer(),
    email: varchar({ length: 255 }),
    website: varchar({ length: 255 }),
    akashVersion: varchar({ length: 255 }),
    cosmosSdkVersion: varchar({ length: 255 }),
    isOnline: boolean(),
    lastCheckDate: timestamp({ withTimezone: true, mode: "string" }),
    error: text(),
    ip: varchar({ length: 255 }),
    ipRegion: varchar({ length: 255 }),
    ipRegionCode: varchar({ length: 255 }),
    ipCountry: varchar({ length: 255 }),
    ipCountryCode: varchar({ length: 255 }),
    ipLat: varchar({ length: 255 }),
    ipLon: varchar({ length: 255 }),
    uptime1d: doublePrecision(),
    uptime7d: doublePrecision(),
    uptime30d: doublePrecision(),
    updatedHeight: integer(),
    lastSnapshotId: uuid(),
    nextCheckDate: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
    failedCheckCount: integer().default(0),
    lastSuccessfulSnapshotId: uuid(),
    downtimeFirstSnapshotId: uuid()
  },
  table => [index("provider_owner").using("btree", table.owner.asc().nullsLast().op("text_ops"))]
);

export const block = pgTable(
  "block",
  {
    height: integer().primaryKey().notNull(),
    datetime: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    hash: varchar({ length: 255 }).notNull(),
    proposer: varchar({ length: 255 }).notNull(),
    dayId: uuid().notNull(),
    txCount: integer().notNull(),
    isProcessed: boolean().default(false).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    totalTxCount: bigint({ mode: "number" }).notNull(),
    totalUAktSpent: doublePrecision(),
    totalUUsdcSpent: doublePrecision(),
    totalUActSpent: doublePrecision(),
    activeLeaseCount: integer(),
    totalLeaseCount: integer(),
    activeCPU: integer(),
    activeGPU: integer(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeMemory: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeEphemeralStorage: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activePersistentStorage: bigint({ mode: "number" }),
    activeProviderCount: integer(),
    totalUUsdSpent: doublePrecision(),
    totalUaktBurnedForUact: doublePrecision(),
    totalUactMinted: doublePrecision(),
    totalUactBurnedForUakt: doublePrecision(),
    totalUaktReminted: doublePrecision(),
    vaultUakt: doublePrecision(),
    outstandingUact: doublePrecision()
  },
  table => [
    index("block_datetime").using("btree", table.datetime.asc().nullsLast().op("timestamptz_ops")),
    index("block_day_id").using("btree", table.dayId.asc().nullsLast().op("uuid_ops")),
    index("block_height_is_processed").using("btree", table.height.asc().nullsLast().op("int4_ops"), table.isProcessed.asc().nullsLast().op("bool_ops")),
    index("block_totaluusdspent_is_null")
      .using("btree", table.height.asc().nullsLast().op("int4_ops"))
      .where(sql`("totalUUsdSpent" IS NULL)`)
  ]
);

export const deploymentGroupResource = pgTable(
  "deploymentGroupResource",
  {
    id: serial().primaryKey().notNull(),
    deploymentGroupId: uuid().notNull(),
    cpuUnits: integer().notNull(),
    gpuUnits: integer().notNull(),
    gpuVendor: varchar({ length: 255 }),
    gpuModel: varchar({ length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    memoryQuantity: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    ephemeralStorageQuantity: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    persistentStorageQuantity: bigint({ mode: "number" }).notNull(),
    count: integer().notNull(),
    price: doublePrecision().notNull()
  },
  table => [
    index("deployment_group_resource_deployment_group_id").using("btree", table.deploymentGroupId.asc().nullsLast().op("uuid_ops")),
    foreignKey({
      columns: [table.deploymentGroupId],
      foreignColumns: [deploymentGroup.id],
      name: "deploymentGroupResource_deploymentGroupId_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const providerAttribute = pgTable(
  "providerAttribute",
  {
    id: serial().primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    key: varchar({ length: 255 }).notNull(),
    value: varchar({ length: 255 }).notNull()
  },
  table => [
    index("provider_attribute_provider").using("btree", table.provider.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.provider],
      foreignColumns: [provider.owner],
      name: "providerAttribute_provider_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const providerSnapshotNode = pgTable(
  "providerSnapshotNode",
  {
    id: uuid().primaryKey().notNull(),
    snapshotId: uuid().notNull(),
    name: varchar({ length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    cpuAllocatable: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    cpuAllocated: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    memoryAllocatable: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    memoryAllocated: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    ephemeralStorageAllocatable: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    ephemeralStorageAllocated: bigint({ mode: "number" }),
    capabilitiesStorageHDD: boolean(),
    capabilitiesStorageSSD: boolean(),
    capabilitiesStorageNVME: boolean(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    gpuAllocatable: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    gpuAllocated: bigint({ mode: "number" })
  },
  table => [index("provider_snapshot_node_snapshot_id").using("btree", table.snapshotId.asc().nullsLast().op("uuid_ops")).with({ deduplicate_items: "true" })]
);

export const providerSnapshotNodeCpu = pgTable(
  "providerSnapshotNodeCPU",
  {
    id: uuid().primaryKey().notNull(),
    snapshotNodeId: uuid().notNull(),
    vendor: varchar({ length: 255 }),
    model: varchar({ length: 255 }),
    vcores: smallint()
  },
  table => [
    index("provider_snapshot_node_c_p_u_snapshot_node_id").using("btree", table.snapshotNodeId.asc().nullsLast().op("uuid_ops")),
    index("provider_snapshot_node_cpu_snapshot_node_id")
      .using("btree", table.snapshotNodeId.asc().nullsLast().op("uuid_ops"))
      .with({ deduplicate_items: "true" })
  ]
);

export const providerSnapshotNodeGpu = pgTable(
  "providerSnapshotNodeGPU",
  {
    id: uuid().primaryKey().notNull(),
    snapshotNodeId: uuid().notNull(),
    vendor: varchar({ length: 255 }),
    name: varchar({ length: 255 }),
    modelId: varchar({ length: 255 }),
    interface: varchar({ length: 255 }),
    memorySize: varchar({ length: 255 })
  },
  table => [
    index("provider_snapshot_node_g_p_u_snapshot_node_id").using("btree", table.snapshotNodeId.asc().nullsLast().op("uuid_ops")),
    index("provider_snapshot_node_gpu_snapshot_node_id")
      .using("btree", table.snapshotNodeId.asc().nullsLast().op("uuid_ops"))
      .with({ deduplicate_items: "true" })
  ]
);

export const providerSnapshotStorage = pgTable(
  "providerSnapshotStorage",
  {
    id: uuid().primaryKey().notNull(),
    snapshotId: uuid().notNull(),
    class: varchar({ length: 255 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    allocatable: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    allocated: bigint({ mode: "number" }).notNull()
  },
  table => [
    index("provider_snapshot_storage_snapshot_id").using("btree", table.snapshotId.asc().nullsLast().op("uuid_ops")).with({ deduplicate_items: "true" })
  ]
);

export const providerSnapshot = pgTable(
  "providerSnapshot",
  {
    id: uuid().primaryKey().notNull(),
    owner: varchar({ length: 255 }).notNull(),
    isOnline: boolean().notNull(),
    checkDate: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    error: text(),
    deploymentCount: integer(),
    leaseCount: integer(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeCPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeGPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeMemory: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activeEphemeralStorage: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pendingCPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pendingGPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pendingMemory: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pendingEphemeralStorage: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    availableCPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    availableGPU: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    availableMemory: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    availableEphemeralStorage: bigint({ mode: "number" }),
    isLastOfDay: boolean().default(false).notNull(),
    isLastSuccessOfDay: boolean().default(false).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    activePersistentStorage: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pendingPersistentStorage: bigint({ mode: "number" }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    availablePersistentStorage: bigint({ mode: "number" })
  },
  table => [
    index("provider_snapshot_checkdate_where_islastsuccessofday")
      .using("btree", table.checkDate.asc().nullsLast().op("timestamptz_ops"))
      .where(sql`("isLastSuccessOfDay" = true)`),
    index("provider_snapshot_id_where_islastsuccessofday")
      .using("btree", table.id.asc().nullsLast().op("uuid_ops"))
      .where(sql`("isLastSuccessOfDay" = true)`),
    index("provider_snapshot_id_where_isonline_and_islastofday")
      .using("btree", table.id.asc().nullsLast().op("uuid_ops"))
      .where(sql`(("isOnline" = true) AND ("isLastOfDay" = true))`),
    index("provider_snapshot_owner").using("btree", table.owner.asc().nullsLast().op("text_ops")),
    index("provider_snapshot_owner_check_date").using(
      "btree",
      table.owner.asc().nullsLast().op("text_ops"),
      table.checkDate.asc().nullsLast().op("timestamptz_ops")
    ),
    foreignKey({
      columns: [table.owner],
      foreignColumns: [provider.owner],
      name: "providerSnapshot_owner_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const validator = pgTable(
  "validator",
  {
    id: uuid().primaryKey().notNull(),
    operatorAddress: varchar({ length: 255 }).notNull(),
    accountAddress: varchar({ length: 255 }).notNull(),
    hexAddress: varchar({ length: 255 }).notNull(),
    createdMsgId: uuid(),
    moniker: varchar({ length: 255 }).notNull(),
    identity: varchar({ length: 255 }),
    website: varchar({ length: 255 }),
    description: text(),
    securityContact: varchar({ length: 255 }),
    rate: doublePrecision().notNull(),
    maxRate: doublePrecision().notNull(),
    maxChangeRate: doublePrecision().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    minSelfDelegation: bigint({ mode: "number" }).notNull(),
    keybaseUsername: varchar({ length: 255 }),
    keybaseAvatarUrl: varchar({ length: 255 })
  },
  table => [
    uniqueIndex("validator_account_address").using("btree", table.accountAddress.asc().nullsLast().op("text_ops")),
    uniqueIndex("validator_hex_address").using("btree", table.hexAddress.asc().nullsLast().op("text_ops")),
    uniqueIndex("validator_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
    uniqueIndex("validator_operator_address").using("btree", table.operatorAddress.asc().nullsLast().op("text_ops"))
  ]
);

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  }
});

export const message = pgTable(
  "message",
  {
    id: uuid().primaryKey().notNull(),
    txId: uuid().notNull(),
    height: integer().notNull(),
    type: varchar({ length: 255 }).notNull(),
    typeCategory: varchar({ length: 255 }).notNull(),
    index: integer().notNull(),
    indexInBlock: integer().notNull(),
    isProcessed: boolean().default(false).notNull(),
    isNotificationProcessed: boolean().default(false).notNull(),
    amount: numeric({ precision: 30, scale: 0 }),
    data: bytea("data").notNull(),
    relatedDeploymentId: uuid()
  },
  table => [
    index("message_height").using("btree", table.height.asc().nullsLast().op("int4_ops")),
    index("message_height_is_notification_processed")
      .using("btree", table.height.asc().nullsLast().op("int4_ops"), table.isNotificationProcessed.asc().nullsLast().op("bool_ops"))
      .where(sql`("isNotificationProcessed" = false)`),
    index("message_height_is_notification_processed_false")
      .using("btree", table.height.asc().nullsLast().op("int4_ops"))
      .where(sql`("isNotificationProcessed" = false)`),
    index("message_height_is_notification_processed_true")
      .using("btree", table.height.asc().nullsLast().op("int4_ops"))
      .where(sql`("isNotificationProcessed" = true)`),
    index("message_height_type").using("btree", table.height.asc().nullsLast().op("int4_ops"), table.type.asc().nullsLast().op("text_ops")),
    index("message_related_deployment_id").using("btree", table.relatedDeploymentId.asc().nullsLast().op("uuid_ops")),
    index("message_tx_id").using("btree", table.txId.asc().nullsLast().op("uuid_ops")),
    index("message_tx_id_is_processed").using("btree", table.txId.asc().nullsLast().op("uuid_ops"), table.isProcessed.asc().nullsLast().op("bool_ops")),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "message_height_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.txId],
      foreignColumns: [transaction.id],
      name: "message_txId_fkey"
    })
      .onUpdate("cascade")
      .onDelete("cascade")
  ]
);

export const addressReference = pgTable(
  "addressReference",
  {
    id: serial().primaryKey().notNull(),
    transactionId: uuid().notNull(),
    messageId: uuid(),
    address: varchar({ length: 255 }).notNull(),
    type: varchar({ length: 255 }).notNull(),
    height: integer()
  },
  table => [
    index("address_reference_address").using("btree", table.address.asc().nullsLast().op("text_ops")),
    index("address_reference_transaction_id").using("btree", table.transactionId.asc().nullsLast().op("uuid_ops")),
    index("address_reference_address_transaction_id").using("btree", table.address.asc().nullsLast(), table.transactionId.asc().nullsLast()),
    index("address_reference_address_height_desc").using(
      "btree",
      table.address.asc().nullsLast().op("text_ops"),
      table.height.desc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [message.id],
      name: "addressReference_messageId_fkey"
    }).onUpdate("cascade"),
    foreignKey({
      columns: [table.transactionId],
      foreignColumns: [transaction.id],
      name: "addressReference_transactionId_fkey"
    }).onUpdate("cascade")
  ]
);

export const transaction = pgTable(
  "transaction",
  {
    id: uuid().primaryKey().notNull(),
    hash: varchar({ length: 255 }).notNull(),
    index: integer().notNull(),
    height: integer().notNull(),
    msgCount: integer().notNull(),
    multisigThreshold: integer(),
    gasUsed: integer().notNull(),
    gasWanted: integer().notNull(),
    fee: numeric({ precision: 30, scale: 0 }).notNull(),
    memo: text().notNull(),
    isProcessed: boolean().default(false).notNull(),
    hasProcessingError: boolean().default(false).notNull(),
    log: text()
  },
  table => [
    index("transaction_hash").using("btree", table.hash.asc().nullsLast().op("text_ops")),
    index("transaction_height").using("btree", table.height.asc().nullsLast().op("int4_ops")),
    index("transaction_height_is_processed_has_processing_error").using(
      "btree",
      table.height.asc().nullsLast().op("bool_ops"),
      table.isProcessed.asc().nullsLast().op("bool_ops"),
      table.hasProcessingError.asc().nullsLast().op("int4_ops")
    ),
    index("transaction_id_has_procesing_error_false")
      .using("btree", table.id.asc().nullsLast().op("uuid_ops"))
      .where(sql`("hasProcessingError" = false)`),
    index("transaction_height_desc_index_desc").using("btree", table.height.desc().nullsLast().op("int4_ops"), table.index.desc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "transaction_height_fkey"
    }).onUpdate("cascade")
  ]
);

export const bmeRawEvent = pgTable(
  "bme_raw_event",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    height: integer().notNull(),
    index: integer().notNull(),
    type: varchar({ length: 255 }).notNull(),
    data: jsonb().notNull(),
    is_processed: boolean().default(false).notNull()
  },
  table => [
    uniqueIndex("bme_raw_event_height_index").using("btree", table.height.asc().nullsLast().op("int4_ops"), table.index.asc().nullsLast().op("int4_ops")),
    index("bme_raw_event_height_is_processed").using(
      "btree",
      table.height.asc().nullsLast().op("int4_ops"),
      table.is_processed.asc().nullsLast().op("bool_ops")
    ),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "bme_raw_event_height_fkey"
    })
  ]
);

export const bmeLedgerRecord = pgTable(
  "bme_ledger_record",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    height: integer().notNull(),
    sequence: integer(),
    burned_from: varchar({ length: 255 }).notNull(),
    minted_to: varchar({ length: 255 }).notNull(),
    burned_denom: varchar({ length: 255 }),
    burned_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    burned_price: numeric({ precision: 20, scale: 10 }),
    minted_denom: varchar({ length: 255 }),
    minted_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    minted_price: numeric({ precision: 20, scale: 10 }),
    remint_credit_issued_amount: numeric({ precision: 30, scale: 0 }),
    remint_credit_accrued_amount: numeric({ precision: 30, scale: 0 })
  },
  table => [
    index("bme_ledger_record_height").using("btree", table.height.asc().nullsLast().op("int4_ops")),
    index("bme_ledger_record_burned_denom_height").using(
      "btree",
      table.burned_denom.asc().nullsLast().op("text_ops"),
      table.height.asc().nullsLast().op("int4_ops")
    ),
    index("bme_ledger_record_minted_denom_height").using(
      "btree",
      table.minted_denom.asc().nullsLast().op("text_ops"),
      table.height.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "bme_ledger_record_height_fkey"
    })
  ]
);

export const bmeStatusChange = pgTable(
  "bme_status_change",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    height: integer().notNull(),
    previous_status: varchar({ length: 255 }).notNull(),
    new_status: varchar({ length: 255 }).notNull(),
    collateral_ratio: numeric({ precision: 20, scale: 10 }).notNull()
  },
  table => [
    index("bme_status_change_height").using("btree", table.height.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "bme_status_change_height_fkey"
    })
  ]
);

export const verificationAuditor = pgTable(
  "verification_auditor",
  {
    address: varchar({ length: 255 }).primaryKey().notNull(),
    status: integer().notNull(),
    max_attestation_tier: integer().notNull(),
    bond_denom: varchar({ length: 255 }).notNull(),
    bond_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    bond_status: integer().notNull(),
    metadata_hash: bytea("metadata_hash"),
    registered_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    renewal_deadline: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    discrepancy_count: numeric({ precision: 20, scale: 0 }).notNull(),
    bond_unbonding_completion_time: timestamp({ withTimezone: true, mode: "string" }),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    index("verification_auditor_status").using("btree", table.status.asc().nullsLast().op("int4_ops")),
    index("verification_auditor_renewal_deadline").using("btree", table.renewal_deadline.asc().nullsLast().op("timestamptz_ops"))
  ]
);

export const verificationAttestation = pgTable(
  "verification_attestation",
  {
    provider: varchar({ length: 255 }).notNull(),
    auditor: varchar({ length: 255 }).notNull(),
    tier: integer().notNull(),
    evidence_hash: bytea("evidence_hash").notNull(),
    fee_denom: varchar({ length: 255 }).notNull(),
    fee_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    fee_status: integer().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    expires_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    status: integer().notNull(),
    voided_reason: integer().notNull(),
    deposit_denom: varchar({ length: 255 }).notNull(),
    deposit_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    deposit_status: integer().notNull(),
    audit_escrow_id: numeric({ precision: 20, scale: 0 }).notNull(),
    fault_attribution: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({ columns: [table.provider, table.auditor], name: "verification_attestation_provider_auditor" }),
    index("verification_attestation_provider_status_tier").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("int4_ops"),
      table.tier.asc().nullsLast().op("int4_ops")
    ),
    index("verification_attestation_expires_at_status").using(
      "btree",
      table.expires_at.asc().nullsLast().op("timestamptz_ops"),
      table.status.asc().nullsLast().op("int4_ops")
    ),
    index("verification_attestation_audit_escrow_id").using("btree", table.audit_escrow_id.asc().nullsLast().op("numeric_ops"))
  ]
);

export const verificationAttestationCapability = pgTable(
  "verification_attestation_capability",
  {
    provider: varchar({ length: 255 }).notNull(),
    auditor: varchar({ length: 255 }).notNull(),
    capability: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({
      columns: [table.provider, table.auditor, table.capability],
      name: "verification_attestation_capability_identity"
    }),
    index("verification_attestation_capability_capability_provider").using(
      "btree",
      table.capability.asc().nullsLast().op("int4_ops"),
      table.provider.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.provider, table.auditor],
      foreignColumns: [verificationAttestation.provider, verificationAttestation.auditor],
      name: "verification_attestation_capability_attestation_fkey"
    }).onDelete("cascade")
  ]
);

export const verificationAuditEscrow = pgTable(
  "verification_audit_escrow",
  {
    id: numeric({ precision: 20, scale: 0 }).primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    consumed_by_auditor: varchar({ length: 255 }).notNull(),
    requested_tier: integer().notNull(),
    fee_denom: varchar({ length: 255 }).notNull(),
    fee_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    fee_status: integer().notNull(),
    provider_deposit_denom: varchar({ length: 255 }).notNull(),
    provider_deposit_amount: numeric({ precision: 30, scale: 0 }).notNull(),
    provider_deposit_status: integer().notNull(),
    status: integer().notNull(),
    opened_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    consumed_at: timestamp({ withTimezone: true, mode: "string" }),
    expires_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    metadata_hash: bytea("metadata_hash"),
    settlement_reason: integer().notNull(),
    fault_attribution: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    index("verification_audit_escrow_provider_status").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("int4_ops")
    ),
    index("verification_audit_escrow_expires_at_status").using(
      "btree",
      table.expires_at.asc().nullsLast().op("timestamptz_ops"),
      table.status.asc().nullsLast().op("int4_ops")
    )
  ]
);

export const verificationAuditEscrowCapability = pgTable(
  "verification_audit_escrow_capability",
  {
    audit_escrow_id: numeric({ precision: 20, scale: 0 }).notNull(),
    capability: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({
      columns: [table.audit_escrow_id, table.capability],
      name: "verification_audit_escrow_capability_identity"
    }),
    index("verification_audit_escrow_capability_capability").using("btree", table.capability.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.audit_escrow_id],
      foreignColumns: [verificationAuditEscrow.id],
      name: "verification_audit_escrow_capability_escrow_fkey"
    }).onDelete("cascade")
  ]
);

export const verificationDiscrepancy = pgTable(
  "verification_discrepancy",
  {
    id: numeric({ precision: 20, scale: 0 }).primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    auditor_a: varchar({ length: 255 }).notNull(),
    auditor_a_tier: integer().notNull(),
    auditor_b: varchar({ length: 255 }).notNull(),
    auditor_b_tier: integer().notNull(),
    detected_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    resolution_status: integer().notNull(),
    resolution_proposal_id: numeric({ precision: 20, scale: 0 }).notNull(),
    grace_record_id: numeric({ precision: 20, scale: 0 }).notNull(),
    resolution_reason: integer().notNull(),
    fault_attribution: integer().notNull(),
    resolution_evidence_hash: bytea("resolution_evidence_hash"),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    index("verification_discrepancy_provider_resolution_status").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.resolution_status.asc().nullsLast().op("int4_ops")
    ),
    index("verification_discrepancy_auditor_a").using("btree", table.auditor_a.asc().nullsLast().op("text_ops")),
    index("verification_discrepancy_auditor_b").using("btree", table.auditor_b.asc().nullsLast().op("text_ops"))
  ]
);

export const verificationGrace = pgTable(
  "verification_grace",
  {
    id: numeric({ precision: 20, scale: 0 }).primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    preserved_tier: integer().notNull(),
    started_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    expires_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    status: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    index("verification_grace_provider_status").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("int4_ops")),
    index("verification_grace_expires_at_status").using(
      "btree",
      table.expires_at.asc().nullsLast().op("timestamptz_ops"),
      table.status.asc().nullsLast().op("int4_ops")
    )
  ]
);

export const verificationGraceDiscrepancy = pgTable(
  "verification_grace_discrepancy",
  {
    grace_id: numeric({ precision: 20, scale: 0 }).notNull(),
    discrepancy_id: numeric({ precision: 20, scale: 0 }).notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({
      columns: [table.grace_id, table.discrepancy_id],
      name: "verification_grace_discrepancy_identity"
    }),
    index("verification_grace_discrepancy_discrepancy_id").using("btree", table.discrepancy_id.asc().nullsLast().op("numeric_ops")),
    foreignKey({
      columns: [table.grace_id],
      foreignColumns: [verificationGrace.id],
      name: "verification_grace_discrepancy_grace_fkey"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.discrepancy_id],
      foreignColumns: [verificationDiscrepancy.id],
      name: "verification_grace_discrepancy_discrepancy_fkey"
    }).onDelete("cascade")
  ]
);

export const verificationProviderBond = pgTable("verification_provider_bond", {
  provider: varchar({ length: 255 }).primaryKey().notNull(),
  bonded_denom: varchar({ length: 255 }).notNull(),
  bonded_amount: numeric({ precision: 30, scale: 0 }).notNull(),
  required_for_current_tier_denom: varchar({ length: 255 }).notNull(),
  required_for_current_tier_amount: numeric({ precision: 30, scale: 0 }).notNull(),
  slashed: boolean().notNull(),
  last_slash_time: timestamp({ withTimezone: true, mode: "string" }),
  observed_height: integer().notNull(),
  observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
});

export const verificationProviderBondUnbonding = pgTable(
  "verification_provider_bond_unbonding",
  {
    provider: varchar({ length: 255 }).notNull(),
    entry_index: integer().notNull(),
    denom: varchar({ length: 255 }).notNull(),
    amount: numeric({ precision: 30, scale: 0 }).notNull(),
    completion_time: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({
      columns: [table.provider, table.entry_index],
      name: "verification_provider_bond_unbonding_identity"
    }),
    index("verification_provider_bond_unbonding_completion_time").using("btree", table.completion_time.asc().nullsLast().op("timestamptz_ops")),
    foreignKey({
      columns: [table.provider],
      foreignColumns: [verificationProviderBond.provider],
      name: "verification_provider_bond_unbonding_bond_fkey"
    }).onDelete("cascade")
  ]
);

export const verificationProviderObservation = pgTable("verification_provider_observation", {
  provider: varchar({ length: 255 }).primaryKey().notNull(),
  observed_height: integer().notNull(),
  observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  effective_tier: integer().notNull(),
  max_placement_tier: integer().notNull(),
  snapshot_state: varchar({ length: 255 }).notNull()
});

export const verificationProviderTierStream = pgTable("verification_provider_tier_stream", {
  id: smallint().primaryKey().notNull(),
  stream_id: uuid()
    .default(sql`gen_random_uuid()`)
    .notNull()
});

export const verificationProviderTierDemotion = pgTable(
  "verification_provider_tier_demotion",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    previous_effective_tier: integer().notNull(),
    previous_max_placement_tier: integer().notNull(),
    previous_snapshot_state: varchar({ length: 255 }).notNull(),
    current_effective_tier: integer().notNull(),
    current_max_placement_tier: integer().notNull(),
    current_snapshot_state: varchar({ length: 255 }).notNull(),
    changes: varchar({ length: 255 }).array().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull()
  },
  table => [
    index("verification_provider_tier_demotion_provider_id").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.id.asc().nullsLast().op("int8_ops")
    ),
    index("verification_provider_tier_demotion_observed_height").using("btree", table.observed_height.asc().nullsLast().op("int4_ops"))
  ]
);

export const verificationProviderSnapshot = pgTable(
  "verification_provider_snapshot",
  {
    provider: varchar({ length: 255 }).primaryKey().notNull(),
    snapshot_hash: bytea("snapshot_hash").notNull(),
    total_gpus: integer().notNull(),
    total_vcpus: integer().notNull(),
    total_memory_mb: numeric({ precision: 20, scale: 0 }).notNull(),
    total_storage_mb: numeric({ precision: 20, scale: 0 }).notNull(),
    active_leases: integer().notNull(),
    software_version: varchar({ length: 255 }).notNull(),
    software_signature: bytea("software_signature"),
    software_identity_version: varchar({ length: 255 }),
    software_artifact_ref: text(),
    software_digest_algorithm: varchar({ length: 255 }),
    software_digest: bytea("software_digest"),
    software_signature_type: varchar({ length: 255 }),
    software_identity_signature: bytea("software_identity_signature"),
    software_signature_ref: text(),
    software_public_key_ref: text(),
    posted_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    snapshot_timestamp: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    compliance_deadline: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    suspended: boolean().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    index("verification_provider_snapshot_compliance_deadline_suspended").using(
      "btree",
      table.compliance_deadline.asc().nullsLast().op("timestamptz_ops"),
      table.suspended.asc().nullsLast().op("bool_ops")
    ),
    index("verification_provider_snapshot_snapshot_timestamp").using("btree", table.snapshot_timestamp.asc().nullsLast().op("timestamptz_ops"))
  ]
);

export const providerMaintenance = pgTable(
  "provider_maintenance",
  {
    provider: varchar({ length: 255 }).notNull(),
    id: numeric({ precision: 20, scale: 0 }).notNull(),
    maintenance_type: integer().notNull(),
    starts_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    expected_ends_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    opened_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    closed_at: timestamp({ withTimezone: true, mode: "string" }),
    metadata_hash: bytea("metadata_hash"),
    status: integer().notNull(),
    observed_height: integer().notNull(),
    observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
  },
  table => [
    primaryKey({ columns: [table.provider, table.id], name: "provider_maintenance_provider_id" }),
    index("provider_maintenance_provider_status").using(
      "btree",
      table.provider.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("int4_ops")
    ),
    index("provider_maintenance_starts_at_expected_ends_at").using(
      "btree",
      table.starts_at.asc().nullsLast().op("timestamptz_ops"),
      table.expected_ends_at.asc().nullsLast().op("timestamptz_ops")
    )
  ]
);

export const verificationParams = pgTable("verification_params", {
  id: smallint().primaryKey().notNull(),
  params: jsonb().notNull(),
  observed_height: integer().notNull(),
  observed_block_time: timestamp({ withTimezone: true, mode: "string" }).notNull()
});

export const verificationReconcileTarget = pgTable(
  "verification_reconcile_target",
  {
    target_type: varchar({ length: 255 }).notNull(),
    target_key: varchar({ length: 255 }).notNull(),
    requested_height: integer().notNull(),
    invalidated: boolean().default(true).notNull(),
    claimed_at: timestamp({ withTimezone: true, mode: "string" }),
    attempt_count: integer().default(0).notNull(),
    next_attempt_at: timestamp({ withTimezone: true, mode: "string" }),
    last_error: text()
  },
  table => [
    primaryKey({
      columns: [table.target_type, table.target_key],
      name: "verification_reconcile_target_identity"
    }),
    index("verification_reconcile_target_claimed_at_next_attempt_at").using(
      "btree",
      table.claimed_at.asc().nullsFirst().op("timestamptz_ops"),
      table.next_attempt_at.asc().nullsFirst().op("timestamptz_ops")
    ),
    index("verification_reconcile_target_requested_height").using("btree", table.requested_height.asc().nullsLast().op("int4_ops"))
  ]
);

export const verificationBlockEvent = pgTable(
  "verification_block_event",
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    height: integer().notNull(),
    index: integer().notNull(),
    type: varchar({ length: 255 }).notNull(),
    data: jsonb().notNull(),
    is_processed: boolean().default(false).notNull()
  },
  table => [
    uniqueIndex("verification_block_event_height_index").using(
      "btree",
      table.height.asc().nullsLast().op("int4_ops"),
      table.index.asc().nullsLast().op("int4_ops")
    ),
    index("verification_block_event_height_is_processed").using(
      "btree",
      table.height.asc().nullsLast().op("int4_ops"),
      table.is_processed.asc().nullsLast().op("bool_ops")
    ),
    foreignKey({
      columns: [table.height],
      foreignColumns: [block.height],
      name: "verification_block_event_height_fkey"
    }).onDelete("cascade")
  ]
);
