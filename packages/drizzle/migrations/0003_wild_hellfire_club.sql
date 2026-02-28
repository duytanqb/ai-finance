CREATE TABLE "analysis_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"report_type" text NOT NULL,
	"result" jsonb NOT NULL,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_watch_digest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"generated_at" timestamp NOT NULL,
	"market_summary" text NOT NULL,
	"top_picks" jsonb NOT NULL,
	"total_scanned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_report" ADD CONSTRAINT "analysis_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_report_user_symbol_idx" ON "analysis_report" USING btree ("user_id","symbol","report_type");--> statement-breakpoint
CREATE INDEX "market_watch_digest_created_idx" ON "market_watch_digest" USING btree ("created_at");