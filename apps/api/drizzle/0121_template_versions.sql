SET lock_timeout = '3s';--> statement-breakpoint
CREATE TYPE "public"."template_moderation_status" AS ENUM('active', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."template_visibility" AS ENUM('private', 'organization', 'public');--> statement-breakpoint
CREATE TYPE "public"."template_version_status" AS ENUM('live', 'held', 'failed_checks');--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"sdl" text NOT NULL,
	"readme" text,
	"asked_values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resources" jsonb,
	"image_digests" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"check_results" jsonb,
	"status" "template_version_status" DEFAULT 'live' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_versions_template_id_version_unique" UNIQUE("template_id","version")
);
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "summary" varchar(300);--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "icon" varchar(32);--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "categories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "visibility" "template_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "official" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "moderation_status" "template_moderation_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_created_by_id_userSetting_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_author_id_userSetting_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."userSetting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "template_versions" ("template_id", "version", "sdl", "created_by_id")
SELECT t."id", 1, t."sdl", u."id" FROM "template" t LEFT JOIN "userSetting" u ON u."userId" = t."userId";--> statement-breakpoint
UPDATE "template" t SET "current_version_id" = v."id" FROM "template_versions" v WHERE v."template_id" = t."id" AND v."version" = 1;--> statement-breakpoint
UPDATE "template" t SET "author_id" = u."id" FROM "userSetting" u WHERE u."userId" = t."userId";--> statement-breakpoint
UPDATE "template" SET "visibility" = 'public', "listed" = false WHERE "isPublic" = true;--> statement-breakpoint
RESET lock_timeout;
