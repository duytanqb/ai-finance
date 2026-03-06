CREATE TABLE "youtube_digest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"generated_at" timestamp NOT NULL,
	"digest" jsonb NOT NULL,
	"videos_processed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_video" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"channel_name" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp,
	"thumbnail_url" text,
	"duration_minutes" integer,
	"summary" jsonb,
	"processed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_video_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE INDEX "youtube_digest_date_idx" ON "youtube_digest" USING btree ("date");--> statement-breakpoint
CREATE INDEX "youtube_digest_created_idx" ON "youtube_digest" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "youtube_video_channel_idx" ON "youtube_video" USING btree ("channel_name");--> statement-breakpoint
CREATE INDEX "youtube_video_processed_idx" ON "youtube_video" USING btree ("processed_at");