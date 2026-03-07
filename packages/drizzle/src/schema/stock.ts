import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const investmentHorizonEnum = pgEnum("investment_horizon", [
  "short-term",
  "medium-term",
  "long-term",
  "hold-forever",
]);

export const portfolioHolding = pgTable(
  "portfolio_holding",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    quantity: real("quantity").notNull(),
    averagePrice: real("average_price").notNull(),
    horizon: investmentHorizonEnum("horizon").notNull(),
    stopLoss: real("stop_loss"),
    takeProfit: real("take_profit"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("portfolio_holding_user_idx").on(table.userId),
    unique("portfolio_holding_user_symbol_uniq").on(table.userId, table.symbol),
  ],
);

export const watchlistItem = pgTable(
  "watchlist_item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    targetPrice: real("target_price"),
    notes: text("notes"),
    aiReview: jsonb("ai_review"),
    aiReviewedAt: timestamp("ai_reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("watchlist_item_user_idx").on(table.userId),
    unique("watchlist_item_user_symbol_uniq").on(table.userId, table.symbol),
  ],
);

export const marketWatchDigest = pgTable(
  "market_watch_digest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    marketSummary: text("market_summary").notNull(),
    topPicks: jsonb("top_picks").notNull(),
    totalScanned: integer("total_scanned").notNull().default(0),
    marketMood: text("market_mood"),
    sectorAnalysis: jsonb("sector_analysis"),
    sectorGroups: jsonb("sector_groups"),
    pipelineType: text("pipeline_type"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("market_watch_digest_created_idx").on(table.createdAt)],
);

export const userCredential = pgTable(
  "user_credential",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedCredentials: text("encrypted_credentials").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("user_credential_user_provider_uniq").on(
      table.userId,
      table.provider,
    ),
    index("user_credential_user_idx").on(table.userId),
  ],
);

export const priceAlert = pgTable(
  "price_alert",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    holdingId: text("holding_id")
      .notNull()
      .references(() => portfolioHolding.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    alertType: text("alert_type").notNull(),
    triggerPrice: real("trigger_price").notNull(),
    currentPrice: real("current_price").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("price_alert_user_idx").on(table.userId),
    index("price_alert_user_read_idx").on(table.userId, table.read),
  ],
);

export const youtubeVideo = pgTable(
  "youtube_video",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: text("video_id").notNull().unique(),
    channelName: text("channel_name").notNull(),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at"),
    thumbnailUrl: text("thumbnail_url"),
    durationMinutes: integer("duration_minutes"),
    summary: jsonb("summary"),
    processedAt: timestamp("processed_at").defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("youtube_video_channel_idx").on(table.channelName),
    index("youtube_video_processed_idx").on(table.processedAt),
  ],
);

export const youtubeDigest = pgTable(
  "youtube_digest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    digest: jsonb("digest").notNull(),
    videosProcessed: integer("videos_processed").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("youtube_digest_date_idx").on(table.date),
    index("youtube_digest_created_idx").on(table.createdAt),
  ],
);

export const analysisReport = pgTable(
  "analysis_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    reportType: text("report_type").notNull(),
    result: jsonb("result").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("analysis_report_user_symbol_idx").on(
      table.userId,
      table.symbol,
      table.reportType,
    ),
  ],
);
