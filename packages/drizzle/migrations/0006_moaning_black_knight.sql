CREATE TABLE "price_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"holding_id" text NOT NULL,
	"symbol" text NOT NULL,
	"alert_type" text NOT NULL,
	"trigger_price" real NOT NULL,
	"current_price" real NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_holding" ADD COLUMN "stop_loss" real;--> statement-breakpoint
ALTER TABLE "portfolio_holding" ADD COLUMN "take_profit" real;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_holding_id_portfolio_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."portfolio_holding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_alert_user_idx" ON "price_alert" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "price_alert_user_read_idx" ON "price_alert" USING btree ("user_id","read");