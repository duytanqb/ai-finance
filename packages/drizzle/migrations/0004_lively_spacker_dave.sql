ALTER TABLE "market_watch_digest" ADD COLUMN "market_mood" text;--> statement-breakpoint
ALTER TABLE "market_watch_digest" ADD COLUMN "sector_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "market_watch_digest" ADD COLUMN "sector_groups" jsonb;--> statement-breakpoint
ALTER TABLE "market_watch_digest" ADD COLUMN "pipeline_type" text;