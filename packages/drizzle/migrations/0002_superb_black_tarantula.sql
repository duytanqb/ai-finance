CREATE TYPE "public"."investment_horizon" AS ENUM('short-term', 'medium-term', 'long-term', 'hold-forever');--> statement-breakpoint
CREATE TABLE "portfolio_holding" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" real NOT NULL,
	"average_price" real NOT NULL,
	"horizon" "investment_horizon" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "portfolio_holding_user_symbol_uniq" UNIQUE("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "watchlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"target_price" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_item_user_symbol_uniq" UNIQUE("user_id","symbol")
);
--> statement-breakpoint
ALTER TABLE "portfolio_holding" ADD CONSTRAINT "portfolio_holding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_holding_user_idx" ON "portfolio_holding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watchlist_item_user_idx" ON "watchlist_item" USING btree ("user_id");