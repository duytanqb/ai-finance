CREATE TABLE "fund_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_symbol" text NOT NULL,
	"fund_name" text NOT NULL,
	"snapshot_date" text NOT NULL,
	"nav" real,
	"holdings" jsonb NOT NULL,
	"industry_allocation" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fund_snapshot_symbol_date_uniq" UNIQUE("fund_symbol","snapshot_date")
);
--> statement-breakpoint
CREATE INDEX "fund_snapshot_symbol_idx" ON "fund_snapshot" USING btree ("fund_symbol");