CREATE TABLE "funding_freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reason" text NOT NULL,
	"frozen_by" text NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_by" text,
	"lifted_at" timestamp with time zone
);
