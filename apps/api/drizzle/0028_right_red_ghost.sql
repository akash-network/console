CREATE TABLE IF NOT EXISTS "template" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"copiedFromId" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"cpu" bigint NOT NULL,
	"ram" bigint NOT NULL,
	"storage" bigint NOT NULL,
	"sdl" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_userId_idx" ON "template" ("userId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templateFavorite" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"templateId" uuid NOT NULL,
	"addedDate" timestamp NOT NULL,
	CONSTRAINT "templateFavorite_templateId_fk" FOREIGN KEY ("templateId") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "templateFavorite_userId_templateId_unique" ON "templateFavorite" ("userId","templateId");
