import {
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
