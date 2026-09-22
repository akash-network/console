CREATE TABLE "lease_gpus" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"dseq" varchar NOT NULL,
	"gseq" integer NOT NULL,
	"oseq" integer NOT NULL,
	"provider" varchar(255) NOT NULL,
	"service" varchar(255) NOT NULL,
	"gpus" jsonb NOT NULL,
	"driver_version" varchar(64),
	"source" varchar(16) NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_gpus_lease_service_idx" UNIQUE("user_id","dseq","gseq","oseq","provider","service")
);
--> statement-breakpoint
ALTER TABLE "lease_gpus" ADD CONSTRAINT "lease_gpus_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;