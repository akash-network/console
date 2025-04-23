-- Current sql file was generated after introspecting the database
CREATE TABLE "deploymentGroup" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deploymentId" uuid NOT NULL,
	"owner" varchar(255) NOT NULL,
	"dseq" varchar(255) NOT NULL,
	"gseq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" varchar(255) NOT NULL,
	"dseq" varchar(255) NOT NULL,
	"gseq" integer NOT NULL,
	"oseq" integer NOT NULL,
	"provider" varchar(255) NOT NULL,
	"price" double precision NOT NULL,
	"createdHeight" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providerAttributeSignature" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(255) NOT NULL,
	"auditor" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"aktPrice" double precision,
	"firstBlockHeight" integer NOT NULL,
	"lastBlockHeight" integer,
	"lastBlockHeightYet" integer NOT NULL,
	"aktPriceChanged" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deploymentId" uuid NOT NULL,
	"deploymentGroupId" uuid NOT NULL,
	"owner" varchar(255) NOT NULL,
	"dseq" varchar(255) NOT NULL,
	"oseq" integer NOT NULL,
	"gseq" integer NOT NULL,
	"providerAddress" varchar(255) NOT NULL,
	"createdHeight" integer NOT NULL,
	"closedHeight" integer,
	"predictedClosedHeight" bigint NOT NULL,
	"price" double precision NOT NULL,
	"withdrawnAmount" double precision DEFAULT '0' NOT NULL,
	"denom" varchar(255) NOT NULL,
	"cpuUnits" integer NOT NULL,
	"gpuUnits" integer NOT NULL,
	"memoryQuantity" bigint NOT NULL,
	"ephemeralStorageQuantity" bigint NOT NULL,
	"persistentStorageQuantity" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner" varchar(255) NOT NULL,
	"dseq" varchar(255) NOT NULL,
	"createdHeight" integer NOT NULL,
	"balance" double precision NOT NULL,
	"deposit" bigint NOT NULL,
	"denom" varchar(255) NOT NULL,
	"lastWithdrawHeight" integer,
	"withdrawnAmount" double precision NOT NULL,
	"closedHeight" integer
);
--> statement-breakpoint
CREATE TABLE "provider" (
	"owner" varchar(255) PRIMARY KEY NOT NULL,
	"hostUri" varchar(255) NOT NULL,
	"createdHeight" integer NOT NULL,
	"deletedHeight" integer,
	"email" varchar(255),
	"website" varchar(255),
	"akashVersion" varchar(255),
	"cosmosSdkVersion" varchar(255),
	"isOnline" boolean,
	"lastCheckDate" timestamp with time zone,
	"error" text,
	"ip" varchar(255),
	"ipRegion" varchar(255),
	"ipRegionCode" varchar(255),
	"ipCountry" varchar(255),
	"ipCountryCode" varchar(255),
	"ipLat" varchar(255),
	"ipLon" varchar(255),
	"uptime1d" double precision,
	"uptime7d" double precision,
	"uptime30d" double precision,
	"updatedHeight" integer,
	"lastSnapshotId" uuid,
	"nextCheckDate" timestamp with time zone DEFAULT now() NOT NULL,
	"failedCheckCount" integer DEFAULT 0,
	"lastSuccessfulSnapshotId" uuid,
	"downtimeFirstSnapshotId" uuid
);
--> statement-breakpoint
CREATE TABLE "block" (
	"height" integer PRIMARY KEY NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"hash" varchar(255) NOT NULL,
	"proposer" varchar(255) NOT NULL,
	"dayId" uuid NOT NULL,
	"txCount" integer NOT NULL,
	"isProcessed" boolean DEFAULT false NOT NULL,
	"totalTxCount" bigint NOT NULL,
	"totalUAktSpent" double precision,
	"totalUUsdcSpent" double precision,
	"activeLeaseCount" integer,
	"totalLeaseCount" integer,
	"activeCPU" integer,
	"activeGPU" integer,
	"activeMemory" bigint,
	"activeEphemeralStorage" bigint,
	"activePersistentStorage" bigint,
	"activeProviderCount" integer,
	"totalUUsdSpent" double precision
);
--> statement-breakpoint
CREATE TABLE "deploymentGroupResource" (
	"id" serial PRIMARY KEY NOT NULL,
	"deploymentGroupId" uuid NOT NULL,
	"cpuUnits" integer NOT NULL,
	"gpuUnits" integer NOT NULL,
	"gpuVendor" varchar(255),
	"gpuModel" varchar(255),
	"memoryQuantity" bigint NOT NULL,
	"ephemeralStorageQuantity" bigint NOT NULL,
	"persistentStorageQuantity" bigint NOT NULL,
	"count" integer NOT NULL,
	"price" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoredValue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tracker" varchar(255) NOT NULL,
	"target" varchar(255) NOT NULL,
	"value" varchar(255),
	"lastUpdateDate" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "providerAttribute" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providerSnapshotNode" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshotId" uuid NOT NULL,
	"name" varchar(255),
	"cpuAllocatable" bigint,
	"cpuAllocated" bigint,
	"memoryAllocatable" bigint,
	"memoryAllocated" bigint,
	"ephemeralStorageAllocatable" bigint,
	"ephemeralStorageAllocated" bigint,
	"capabilitiesStorageHDD" boolean,
	"capabilitiesStorageSSD" boolean,
	"capabilitiesStorageNVME" boolean,
	"gpuAllocatable" bigint,
	"gpuAllocated" bigint
);
--> statement-breakpoint
CREATE TABLE "providerSnapshotNodeCPU" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshotNodeId" uuid NOT NULL,
	"vendor" varchar(255),
	"model" varchar(255),
	"vcores" smallint
);
--> statement-breakpoint
CREATE TABLE "providerSnapshotNodeGPU" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshotNodeId" uuid NOT NULL,
	"vendor" varchar(255),
	"name" varchar(255),
	"modelId" varchar(255),
	"interface" varchar(255),
	"memorySize" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "providerSnapshotStorage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshotId" uuid NOT NULL,
	"class" varchar(255) NOT NULL,
	"allocatable" bigint NOT NULL,
	"allocated" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providerSnapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner" varchar(255) NOT NULL,
	"isOnline" boolean NOT NULL,
	"checkDate" timestamp with time zone NOT NULL,
	"error" text,
	"deploymentCount" integer,
	"leaseCount" integer,
	"activeCPU" bigint,
	"activeGPU" bigint,
	"activeMemory" bigint,
	"activeEphemeralStorage" bigint,
	"pendingCPU" bigint,
	"pendingGPU" bigint,
	"pendingMemory" bigint,
	"pendingEphemeralStorage" bigint,
	"availableCPU" bigint,
	"availableGPU" bigint,
	"availableMemory" bigint,
	"availableEphemeralStorage" bigint,
	"isLastOfDay" boolean DEFAULT false NOT NULL,
	"isLastSuccessOfDay" boolean DEFAULT false NOT NULL,
	"activePersistentStorage" bigint,
	"pendingPersistentStorage" bigint,
	"availablePersistentStorage" bigint
);
--> statement-breakpoint
CREATE TABLE "validator" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operatorAddress" varchar(255) NOT NULL,
	"accountAddress" varchar(255) NOT NULL,
	"hexAddress" varchar(255) NOT NULL,
	"createdMsgId" uuid,
	"moniker" varchar(255) NOT NULL,
	"identity" varchar(255),
	"website" varchar(255),
	"description" text,
	"securityContact" varchar(255),
	"rate" double precision NOT NULL,
	"maxRate" double precision NOT NULL,
	"maxChangeRate" double precision NOT NULL,
	"minSelfDelegation" bigint NOT NULL,
	"keybaseUsername" varchar(255),
	"keybaseAvatarUrl" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"txId" uuid NOT NULL,
	"height" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"typeCategory" varchar(255) NOT NULL,
	"index" integer NOT NULL,
	"indexInBlock" integer NOT NULL,
	"isProcessed" boolean DEFAULT false NOT NULL,
	"isNotificationProcessed" boolean DEFAULT false NOT NULL,
	"amount" numeric(30, 0),
	"data" "bytea" NOT NULL,
	"relatedDeploymentId" uuid
);
--> statement-breakpoint
CREATE TABLE "addressReference" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionId" uuid NOT NULL,
	"messageId" uuid,
	"address" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hash" varchar(255) NOT NULL,
	"index" integer NOT NULL,
	"height" integer NOT NULL,
	"msgCount" integer NOT NULL,
	"multisigThreshold" integer,
	"gasUsed" integer NOT NULL,
	"gasWanted" integer NOT NULL,
	"fee" numeric(30, 0) NOT NULL,
	"memo" text NOT NULL,
	"isProcessed" boolean DEFAULT false NOT NULL,
	"hasProcessingError" boolean DEFAULT false NOT NULL,
	"log" text
);
--> statement-breakpoint
ALTER TABLE "deploymentGroup" ADD CONSTRAINT "deploymentGroup_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "providerAttributeSignature" ADD CONSTRAINT "providerAttributeSignature_provider_fkey" FOREIGN KEY ("provider") REFERENCES "public"."provider"("owner") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_deploymentGroupId_fkey" FOREIGN KEY ("deploymentGroupId") REFERENCES "public"."deploymentGroup"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_providerAddress_fkey" FOREIGN KEY ("providerAddress") REFERENCES "public"."provider"("owner") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deploymentGroupResource" ADD CONSTRAINT "deploymentGroupResource_deploymentGroupId_fkey" FOREIGN KEY ("deploymentGroupId") REFERENCES "public"."deploymentGroup"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "providerAttribute" ADD CONSTRAINT "providerAttribute_provider_fkey" FOREIGN KEY ("provider") REFERENCES "public"."provider"("owner") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "providerSnapshot" ADD CONSTRAINT "providerSnapshot_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."provider"("owner") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_height_fkey" FOREIGN KEY ("height") REFERENCES "public"."block"("height") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_txId_fkey" FOREIGN KEY ("txId") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "addressReference" ADD CONSTRAINT "addressReference_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "addressReference" ADD CONSTRAINT "addressReference_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."transaction"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_height_fkey" FOREIGN KEY ("height") REFERENCES "public"."block"("height") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "deployment_group_owner_dseq_gseq" ON "deploymentGroup" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops);--> statement-breakpoint
CREATE INDEX "bid_owner_dseq_gseq_oseq_provider" ON "bid" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops,"provider" text_ops);--> statement-breakpoint
CREATE INDEX "provider_attribute_signature_provider" ON "providerAttributeSignature" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "day_date" ON "day" USING btree ("date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "day_first_block_height" ON "day" USING btree ("firstBlockHeight" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "day_last_block_height" ON "day" USING btree ("lastBlockHeight" int4_ops);--> statement-breakpoint
CREATE INDEX "lease_closed_height" ON "lease" USING btree ("closedHeight" int4_ops);--> statement-breakpoint
CREATE INDEX "lease_deployment_id" ON "lease" USING btree ("deploymentId" uuid_ops);--> statement-breakpoint
CREATE INDEX "lease_owner_dseq_gseq_oseq" ON "lease" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops);--> statement-breakpoint
CREATE INDEX "lease_predicted_closed_height" ON "lease" USING btree ("predictedClosedHeight" int8_ops);--> statement-breakpoint
CREATE INDEX "lease_provider_address_closed_height_created_height" ON "lease" USING btree ("providerAddress" text_ops,"closedHeight" int4_ops,"createdHeight" int4_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "deployment_created_height_closed_height" ON "deployment" USING btree ("createdHeight" int4_ops,"closedHeight" int4_ops);--> statement-breakpoint
CREATE INDEX "deployment_owner" ON "deployment" USING btree ("owner" text_ops);--> statement-breakpoint
CREATE INDEX "provider_owner" ON "provider" USING btree ("owner" text_ops);--> statement-breakpoint
CREATE INDEX "block_datetime" ON "block" USING btree ("datetime" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "block_day_id" ON "block" USING btree ("dayId" uuid_ops);--> statement-breakpoint
CREATE INDEX "block_height_is_processed" ON "block" USING btree ("height" int4_ops,"isProcessed" bool_ops);--> statement-breakpoint
CREATE INDEX "block_totaluusdspent_is_null" ON "block" USING btree ("height" int4_ops) WHERE ("totalUUsdSpent" IS NULL);--> statement-breakpoint
CREATE INDEX "deployment_group_resource_deployment_group_id" ON "deploymentGroupResource" USING btree ("deploymentGroupId" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_value_tracker_target" ON "monitoredValue" USING btree ("tracker" text_ops,"target" text_ops);--> statement-breakpoint
CREATE INDEX "provider_attribute_provider" ON "providerAttribute" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "provider_snapshot_node_snapshot_id" ON "providerSnapshotNode" USING btree ("snapshotId" uuid_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_node_c_p_u_snapshot_node_id" ON "providerSnapshotNodeCPU" USING btree ("snapshotNodeId" uuid_ops);--> statement-breakpoint
CREATE INDEX "provider_snapshot_node_cpu_snapshot_node_id" ON "providerSnapshotNodeCPU" USING btree ("snapshotNodeId" uuid_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_node_g_p_u_snapshot_node_id" ON "providerSnapshotNodeGPU" USING btree ("snapshotNodeId" uuid_ops);--> statement-breakpoint
CREATE INDEX "provider_snapshot_node_gpu_snapshot_node_id" ON "providerSnapshotNodeGPU" USING btree ("snapshotNodeId" uuid_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_storage_snapshot_id" ON "providerSnapshotStorage" USING btree ("snapshotId" uuid_ops) WITH (deduplicate_items=true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_checkdate_where_islastsuccessofday" ON "providerSnapshot" USING btree ("checkDate" timestamptz_ops) WHERE ("isLastSuccessOfDay" = true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_id_where_islastsuccessofday" ON "providerSnapshot" USING btree ("id" uuid_ops) WHERE ("isLastSuccessOfDay" = true);--> statement-breakpoint
CREATE INDEX "provider_snapshot_id_where_isonline_and_islastofday" ON "providerSnapshot" USING btree ("id" uuid_ops) WHERE (("isOnline" = true) AND ("isLastOfDay" = true));--> statement-breakpoint
CREATE INDEX "provider_snapshot_owner" ON "providerSnapshot" USING btree ("owner" text_ops);--> statement-breakpoint
CREATE INDEX "provider_snapshot_owner_check_date" ON "providerSnapshot" USING btree ("owner" text_ops,"checkDate" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "validator_account_address" ON "validator" USING btree ("accountAddress" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "validator_hex_address" ON "validator" USING btree ("hexAddress" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "validator_id" ON "validator" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "validator_operator_address" ON "validator" USING btree ("operatorAddress" text_ops);--> statement-breakpoint
CREATE INDEX "message_height" ON "message" USING btree ("height" int4_ops);--> statement-breakpoint
CREATE INDEX "message_height_is_notification_processed" ON "message" USING btree ("height" int4_ops,"isNotificationProcessed" bool_ops) WHERE ("isNotificationProcessed" = false);--> statement-breakpoint
CREATE INDEX "message_height_is_notification_processed_false" ON "message" USING btree ("height" int4_ops) WHERE ("isNotificationProcessed" = false);--> statement-breakpoint
CREATE INDEX "message_height_is_notification_processed_true" ON "message" USING btree ("height" int4_ops) WHERE ("isNotificationProcessed" = true);--> statement-breakpoint
CREATE INDEX "message_height_type" ON "message" USING btree ("height" int4_ops,"type" text_ops);--> statement-breakpoint
CREATE INDEX "message_related_deployment_id" ON "message" USING btree ("relatedDeploymentId" uuid_ops);--> statement-breakpoint
CREATE INDEX "message_tx_id" ON "message" USING btree ("txId" uuid_ops);--> statement-breakpoint
CREATE INDEX "message_tx_id_is_processed" ON "message" USING btree ("txId" uuid_ops,"isProcessed" bool_ops);--> statement-breakpoint
CREATE INDEX "address_reference_address" ON "addressReference" USING btree ("address" text_ops);--> statement-breakpoint
CREATE INDEX "address_reference_transaction_id" ON "addressReference" USING btree ("transactionId" uuid_ops);--> statement-breakpoint
CREATE INDEX "transaction_hash" ON "transaction" USING btree ("hash" text_ops);--> statement-breakpoint
CREATE INDEX "transaction_height" ON "transaction" USING btree ("height" int4_ops);--> statement-breakpoint
CREATE INDEX "transaction_height_is_processed_has_processing_error" ON "transaction" USING btree ("height" int4_ops,"isProcessed" bool_ops,"hasProcessingError" bool_ops);--> statement-breakpoint
CREATE INDEX "transaction_id_has_procesing_error_false" ON "transaction" USING btree ("id" uuid_ops) WHERE ("hasProcessingError" = false);
