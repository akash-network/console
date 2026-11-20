CREATE TABLE "email_domain_mail_hosts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"domain" varchar(253) NOT NULL,
	"mx_hosts" text[] NOT NULL,
	"self_hosted_mx_ips" text[] NOT NULL,
	"has_website" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_domain_mail_hosts_domain_unique" ON "email_domain_mail_hosts" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "email_domain_mail_hosts_self_hosted_mx_ips_idx" ON "email_domain_mail_hosts" USING gin ("self_hosted_mx_ips");