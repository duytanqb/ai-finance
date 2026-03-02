# AI Finance - Vietnam Stock Market Assistant

## Project Overview

AI-powered finance platform for Vietnam stock market (HOSE, HNX, UPCOM). The system helps users analyze stocks, track portfolios, discover undervalued stocks, and perform deep research using AI. **No chat interface** — AI runs as action workflows triggered by button clicks and scheduled jobs.

**Based on:** [CleanStack](https://github.com/axelhamil/CleanStack) (Clean Architecture + DDD)

## Tech Stack

- **Frontend:** Next.js 16 + TypeScript + TailwindCSS 4 + shadcn/ui + lightweight-charts (TradingView open-source)
- **Backend:** Next.js API Routes + Python microservice (FastAPI) for stock data via `vnstock`
- **AI:** Claude API (Sonnet for fast tasks, Opus for deep research) — action-driven, no chat
- **Data:** DNSE Lightspeed API (price/chart), vnstock (VCI — financials/listings), CafeF/VnExpress/Vietstock news crawl
- **Database:** PostgreSQL + Drizzle ORM + Redis (stock data cache)
- **Auth:** BetterAuth (from CleanStack)
- **Deploy:** Vercel (web) + Railway (Python service) + Supabase (DB)

## Quick Start

### 1. Setup
```bash
git clone <repo>
cd ai-finance
pnpm install
pnpm db           # Start PostgreSQL
pnpm db:push      # Push schema
pnpm dev          # Start Next.js dev server

# Python stock service
cd apps/stock-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Deploy to Ubuntu VPS

### Architecture

```
Internet → Nginx (443/80)
              ├── / → Next.js (localhost:3000)
              └── /stock-api/ → Python FastAPI (localhost:8000)

Next.js ←→ Python service (internal, localhost:8000)
Next.js ←→ PostgreSQL (Supabase remote)
Python  ←→ Redis (localhost:6379)
```

### Prerequisites

- Ubuntu 22.04+ VPS (2GB RAM minimum, 4GB recommended)
- Domain name pointed to VPS IP
- Supabase project (PostgreSQL)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Python 3.12
sudo apt install -y python3.12 python3.12-venv python3-pip

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server

# Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# Install PM2 (process manager)
npm install -g pm2
```

### Step 2: Clone and Build

```bash
# Clone repo
cd /opt
sudo mkdir ai-finance && sudo chown $USER:$USER ai-finance
git clone <repo-url> ai-finance
cd ai-finance

# Install dependencies
pnpm install

# Setup Python service
cd apps/stock-service
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd /opt/ai-finance

# Build Next.js
pnpm build
```

### Step 3: Environment Variables

```bash
# Next.js env
cat > /opt/ai-finance/.env << 'EOF'
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_APP_URL=https://yourdomain.com
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://yourdomain.com
STOCK_SERVICE_URL=http://localhost:8000
CREDENTIAL_ENCRYPTION_KEY=<openssl rand -hex 32>
EOF

# Python service env
cat > /opt/ai-finance/apps/stock-service/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-xxx
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=https://yourdomain.com,http://localhost:3000
APP_URL=http://localhost:3000
EOF
```

### Step 4: Push DB Schema

```bash
cd /opt/ai-finance
pnpm db:push
```

### Step 5: PM2 Process Management

```bash
# Create PM2 ecosystem config
cat > /opt/ai-finance/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: "nextjs",
      cwd: "/opt/ai-finance/apps/nextjs",
      script: "node",
      args: ".next/standalone/apps/nextjs/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
    {
      name: "stock-service",
      cwd: "/opt/ai-finance/apps/stock-service",
      script: "/opt/ai-finance/apps/stock-service/venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "none",
      env: {
        PATH: "/opt/ai-finance/apps/stock-service/venv/bin:/usr/bin:/bin",
      },
    },
  ],
};
EOF

# Copy standalone static files (Next.js standalone needs this)
cp -r /opt/ai-finance/apps/nextjs/.next/static /opt/ai-finance/apps/nextjs/.next/standalone/apps/nextjs/.next/static
cp -r /opt/ai-finance/apps/nextjs/public /opt/ai-finance/apps/nextjs/.next/standalone/apps/nextjs/public

# Start services
cd /opt/ai-finance
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow printed instructions to enable on boot
```

### Step 6: Nginx Reverse Proxy + SSL

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Create Nginx config
sudo cat > /etc/nginx/sites-available/ai-finance << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/ai-finance /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### Step 7: Verify

```bash
# Check processes
pm2 status

# Check health
curl http://localhost:3000
curl http://localhost:8000/health

# Check logs
pm2 logs nextjs --lines 20
pm2 logs stock-service --lines 20
```

### Deploy Updates

```bash
cd /opt/ai-finance
git pull origin main
pnpm install
pnpm build

# Copy static files for standalone
cp -r apps/nextjs/.next/static apps/nextjs/.next/standalone/apps/nextjs/.next/static

# Update Python deps if needed
cd apps/stock-service && source venv/bin/activate && pip install -r requirements.txt && deactivate
cd /opt/ai-finance

# Restart
pm2 restart all
```

### Monitoring

```bash
pm2 monit           # Real-time dashboard
pm2 logs             # All logs
pm2 logs nextjs      # Next.js only
pm2 logs stock-service  # Python only
sudo systemctl status redis-server
sudo systemctl status nginx
```

## Core Features

### Phase 1 — Foundation (Done)
- [x] Stock lookup by ticker — full-page search with 300ms debounce, popular stocks default
- [x] Price charts — lightweight-charts (Candle/Line/Area, 7 intervals: 1m–1W) powered by DNSE free API
- [x] Fundamental metrics — P/E, ROE, EPS, P/B, D/E, Market Cap on stock detail page (vnstock/VCI)
- [x] **"Analyze Stock" AI button** — fetches price + financials + news → Claude Sonnet → BUY/WATCH/AVOID report, persisted to DB
- [ ] Full financial statements UI (income, balance sheet, cash flow) — API exists, frontend not built

### Phase 2 — Portfolio & Watchlist (Mostly Done)
- [x] Portfolio CRUD with **investment horizon** (`short-term`, `medium-term`, `long-term`, `hold-forever`) — full Clean Architecture (domain/use-cases/repository)
- [x] **AI portfolio review** — on-demand HOLD/SELL/ADD_MORE per holding with reasoning (button on portfolio page)
- [x] Portfolio P&L — total value, total P&L %, win rate, holding count
- [x] Watchlist — table layout with price, change, ref price, high/low, volume, target price proximity, clickable symbols
- [x] Value screener — filter by exchange, P/E, P/B, ROE, market cap, dividend yield (page exists at `/screener`, not in nav)
- [ ] Daily automated P&L update after market close
- [ ] VN-Index benchmark comparison (dashboard shows "Coming soon")
- [ ] Asset allocation breakdown (by sector, exchange, horizon)

### Phase 3 — Market Watch (Done)
- [x] **Sector-first pipeline** — 5-stage funnel running every 6h:
  1. News → Sector Discovery (crawl 40 CafeF/VnExpress/Vietstock headlines → AI identifies 3-5 hot sectors)
  2. Sector → Stock Discovery (find stocks in hot sectors → light pre-filter, HOSE/HNX only)
  3. Quality Gate (financial disqualifiers + composite score)
  4. AI Analysis with sector context (batch assess + full analysis top 5)
  5. News Enrichment (per-candidate articles)
- [x] **News crawler** — CafeF + VnExpress + Vietstock, Vietnamese date parsing, market-wide + per-stock
- [x] **Pipeline progress tracking** — real-time stage updates via SSE, stepper UI on Market Watch page
- [x] **Market Watch dashboard** — market mood badge, sector overview cards with confidence bars, stock picks grouped by sector, manual refresh with async polling
- [x] DB persistence — `market_watch_digest` table with sector_analysis, sector_groups, market_mood, pipeline_type

### Phase 4 — AI Deep Research (Partially Done)
- [x] **"Deep Research" button** — SSE streaming, 4-section report (cơ bản, biểu đồ nến, công ty, tóm tắt), persisted to DB
- [x] **"Compare" API** — backend exists (`/api/ai/compare`), no frontend UI
- [ ] **"Sector Overview" button** — not implemented (sector analysis only in Market Watch pipeline)
- [ ] **"Screen with AI" button** — natural language → AI filters, not implemented

### Phase 5 — DNSE Trading Integration (In Progress)
- [x] **DNSE chart data** — free OHLC API for stock + index charts, no auth required
- [x] **DNSE credential storage** — per-user API Key + Secret, AES-256-GCM encrypted in DB (`user_credential` table)
- [x] **Trading settings page** — `/settings/trading` with save/test/remove for DNSE API credentials
- [x] **DNSE OpenAPI auth** — HMAC-SHA256 signature verification (X-API-Key + X-Signature + X-Timestamp)
- [ ] Live trading API integration (order placement, account info)
- [ ] Real-time MQTT price feed (`datafeed-lts.dnse.com.vn:443/wss`)
- [ ] Push notifications and alerts
- [ ] Dividend tracking and calendar

### Navigation (Sidebar)
Dashboard, Stocks, Portfolio, Watchlist, Market Watch, Reports, Settings

### Pages Status
| Page | Status |
|------|--------|
| `/dashboard` | Stats cards + recent AI reports. VN-Index/HNX "Coming soon" |
| `/stocks` | Search + popular stocks list |
| `/stocks/[symbol]` | lightweight-charts (DNSE) + metrics + Analyze + Deep Research buttons |
| `/portfolio` | CRUD table + P&L + AI Review button |
| `/watchlist` | Price table + target tracking |
| `/market-watch` | Sector cards + grouped stock picks + refresh |
| `/screener` | Filter form (not in nav) |
| `/reports` | Stub — shows empty state only |
| `/settings/trading` | DNSE API Key/Secret form + test connection |

## AI Architecture (Action-Driven)

```
┌─── On-Demand Actions ──────────────────────────────┐
│                                                     │
│  "Analyze Stock" → price + ratios + news → Sonnet  │
│  "Deep Research" → 4-section SSE stream → Sonnet   │
│  "AI Review"     → portfolio holdings → Sonnet     │
│  "Compare"       → 2-3 stocks side-by-side (API)   │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─── Market Watch Pipeline (every 6h) ───────────────┐
│                                                     │
│  Stage 1: crawl_market_news(40) → Sonnet →         │
│           identify 3-5 hot sectors                  │
│  Stage 2: get_stocks_by_industry() → pre-filter    │
│  Stage 3: quality_gate (income + balance check)    │
│  Stage 4: batch_assess_with_sectors → Sonnet →     │
│           full_analysis top 5 → Sonnet             │
│  Stage 5: crawl_news per candidate                 │
│                                                     │
│  Output → market_watch_digest DB → frontend        │
└─────────────────────────────────────────────────────┘
```

## Project Structure

```
ai-finance/
├── CLAUDE.md
├── apps/
│   ├── nextjs/                        # Next.js web app (CleanStack)
│   │   ├── src/
│   │   │   ├── domain/                # Portfolio, Watchlist aggregates
│   │   │   ├── application/
│   │   │   │   ├── use-cases/         # Portfolio CRUD, Watchlist CRUD
│   │   │   │   ├── ports/             # IPortfolioRepository, IWatchlistRepository
│   │   │   │   └── dto/               # Zod schemas
│   │   │   └── adapters/
│   │   │       ├── repositories/      # Drizzle implementations
│   │   │       ├── mappers/           # Domain ↔ DB mappers
│   │   │       └── guards/            # Auth guards
│   │   ├── common/di/                 # DI container + modules
│   │   ├── lib/
│   │   │   ├── stock-service.ts       # Python service HTTP client
│   │   │   └── encryption.ts          # AES-256-GCM encrypt/decrypt for credentials
│   │   └── app/
│   │       ├── (protected)/
│   │       │   ├── dashboard/         # Stats + recent reports
│   │       │   ├── stocks/            # Search + [symbol] detail (lightweight-charts)
│   │       │   ├── portfolio/         # CRUD + AI review
│   │       │   ├── watchlist/         # Price monitoring
│   │       │   ├── market-watch/      # Sector-first digest + pipeline stepper
│   │       │   ├── screener/          # Filter form
│   │       │   ├── settings/trading/  # DNSE API credential management
│   │       │   └── reports/           # Stub
│   │       └── api/
│   │           ├── stocks/            # Proxy to Python service
│   │           ├── portfolio/         # CRUD + AI review
│   │           ├── watchlist/         # CRUD
│   │           ├── settings/credentials/ # DNSE credential CRUD + test
│   │           └── dashboard/         # Stats query
│   │
│   └── stock-service/                 # Python FastAPI microservice
│       ├── main.py                    # CORS from env, scheduler lifespan
│       ├── routers/
│       │   ├── price.py               # /api/price/history (DNSE+VCI), /api/price/board, /api/price/index
│       │   ├── financial.py           # /api/financial/{symbol}/ratios, income, balance, cashflow
│       │   ├── screening.py           # /api/screening/scan
│       │   ├── listing.py             # /api/listing/symbols, /api/listing/search
│       │   ├── ai_actions.py          # /api/ai/analyze, deep-research, compare, portfolio-review
│       │   ├── market_watch.py        # /api/market-watch/digest, status, latest
│       │   └── dnse.py                # /api/dnse/verify (API key verification)
│       ├── services/
│       │   ├── vnstock_client.py      # VCI data: financials, ratios, listings, industries
│       │   ├── dnse_client.py         # DNSE API: OHLC charts, index data, OpenAPI auth
│       │   ├── news_crawler.py        # CafeF + VnExpress + Vietstock scraper
│       │   ├── ai_workflows.py        # All Claude prompts + workflow methods
│       │   ├── claude_client.py       # Anthropic API wrapper (Sonnet/Opus)
│       │   └── cache.py               # Redis TTL cache
│       ├── jobs/
│       │   ├── scheduler.py           # APScheduler, 6h interval, VN timezone
│       │   ├── daily_scan.py          # Stage 2: sector → stock discovery
│       │   ├── quality_gate.py        # Stage 3: financial disqualifiers + score
│       │   ├── deep_research.py       # Stage 4: AI batch assess + full analysis
│       │   ├── news_fetch.py          # Stage 5: per-candidate news
│       │   └── digest.py              # Orchestrator: 5-stage pipeline
│       └── requirements.txt
│
├── packages/
│   ├── ddd-kit/                       # DDD primitives (Result, Option, Entity)
│   ├── drizzle/                       # DB schema (auth, stock, portfolio, watchlist, user_credential)
│   └── ui/                            # Shared shadcn/ui components
│
└── docker-compose.yaml                # Local dev: PostgreSQL only
```

## Environment Variables

**Next.js** (`.env` at root):
```env
DATABASE_URL=postgresql://...           # Supabase or local PostgreSQL
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=                      # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
STOCK_SERVICE_URL=http://localhost:8000  # Python service URL
CREDENTIAL_ENCRYPTION_KEY=              # openssl rand -hex 32 (64-char hex, for DNSE credential encryption)
```

**Python stock service** (`apps/stock-service/.env`):
```env
ANTHROPIC_API_KEY=sk-ant-...            # Claude API key
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000      # Comma-separated for multiple origins
APP_URL=http://localhost:3000           # Next.js URL for DB save callback
```

## Data Sources

### DNSE Lightspeed API (price/chart data)
- **Chart API** (free, no auth): `services.entrade.com.vn/chart-api/v2/ohlcs/stock` — OHLC at 1/5/15/30/1H/1D/1W
- **Index API** (free): `services.entrade.com.vn/chart-api/v2/ohlcs/index` — VN-Index, HNX-Index
- **OpenAPI** (auth required): `openapi.dnse.com.vn` — uses `X-API-Key` + `X-Signature` (HMAC-SHA256) + `X-Timestamp`
- **Price format**: 1000 VND units (65.0 = 65,000 VND)
- **Does NOT provide**: financials, ratios, company profiles, listings, search, screening

### vnstock / VCI (financials, listings, screening)
- Python-only library (`pip install vnstock`) — no JS SDK, no REST API
- Provides: financial statements, ratios (P/E, P/B, ROE, EPS), company profiles, industry data, stock listings, search, screening
- Required for: AI analysis, deep research, portfolio review, market watch pipeline, screener
- **Cannot be replaced** by DNSE — Python service is required

### News Crawlers
- CafeF, VnExpress, Vietstock — market-wide + per-stock headlines
- Vietnamese date parsing, deduplication

---

## CleanStack Architecture Reference

> Everything below is from CleanStack — the foundation this project is built on.

### Build a Feature (All-in-One)
```
/feature "Users can bookmark articles"
```
Complete feature generation: discovery → domain → application → infrastructure → adapters → UI → validation.

### Or Use Granular Skills
```
/feature-prd           # Conversational PRD with EventStorming
/gen-domain            # Domain layer (aggregate, VOs, events)
/gen-usecase           # Application layer (use case, DTOs, ports)
/gen-tests             # BDD tests
/gen-action            # Server actions
/gen-route             # API routes + controllers
/gen-handler           # Event handlers
/gen-page              # Next.js pages
/gen-form              # Forms with validation
/gen-query             # CQRS queries
```

### Validate & Deploy
```bash
pnpm test              # All tests pass
pnpm check:all         # Lint, types, tests, duplication, unused
```

### 2. Build a Feature (All-in-One)
```
/feature "Users can bookmark articles"
```
Complete feature generation: discovery → domain → application → infrastructure → adapters → UI → validation.

### 3. Or Use Granular Skills
```
/feature-prd           # Conversational PRD with EventStorming
/gen-domain            # Domain layer (aggregate, VOs, events)
/gen-usecase           # Application layer (use case, DTOs, ports)
/gen-tests             # BDD tests
/gen-action            # Server actions
/gen-route             # API routes + controllers
/gen-handler           # Event handlers
/gen-page              # Next.js pages
/gen-form              # Forms with validation
/gen-query             # CQRS queries
```

### 4. Validate & Deploy
```bash
pnpm test              # All tests pass
pnpm check:all         # Lint, types, tests, duplication, unused
```

### Example: Add "Bookmark" Feature

**Option A: All-in-One**
```
/feature "Users can bookmark articles"
```
Claude handles everything: discovery, TDD, implementation, UI.

**Option B: Step-by-Step**
1. `/feature-prd` → "Users can bookmark articles"
2. `/gen-domain Bookmark with userId, articleId, createdAt`
3. `/gen-usecase CreateBookmark`
4. `/gen-tests CreateBookmarkUseCase`
5. `/gen-action Bookmark`
6. `/gen-page Bookmarks list`
7. `pnpm check:all` → All green

---

## Prerequisites

**Read first:** `packages/ddd-kit/src/` (Result, Option, Entity) • `packages/test/`

## Project Overview

Production-ready monorepo: Clean Architecture + DDD. Optimized for AI development.

**Stack**: Next.js 16 • TypeScript • Drizzle • PostgreSQL • BetterAuth • shadcn/ui • Tailwind 4

### Reference Implementation

**Complete auth example** (100% Claude Code): Sign up/in/out, sessions, email verification, protected routes.

Study these files:
- `src/domain/user/` - Aggregate, VOs, events
- `src/application/use-cases/auth/` - All auth use cases
- `src/application/ports/` - IAuthProvider, IUserRepository
- `src/adapters/services/auth/` - BetterAuth service
- `src/adapters/guards/` - requireAuth()
- `app/(auth)/` + `app/(protected)/` - Pages

## Commands

```bash
# Development
pnpm dev              # Dev server (Next.js)
pnpm build            # Build all

# Quality
pnpm type-check       # TypeScript check
pnpm check            # Biome lint + format check
pnpm fix              # Auto-fix lint/format issues
pnpm check:duplication # Code duplication check
pnpm check:unused     # Unused code check (knip)
pnpm check:all        # Run all checks + tests

# Testing
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage

# Database
pnpm db               # Start PostgreSQL
pnpm db:push          # Push schema
pnpm db:generate      # Generate migrations

# UI
pnpm ui:add           # Add shadcn component
```

## Architecture

```
Domain (Core)     → Entities, VOs, Aggregates, Events
    ↑
Application       → Use Cases, Ports
    ↑
Adapters          → Controllers, Repositories, Guards
    ↑
Infrastructure    → DB, DI config
```

### Structure

```
apps/nextjs/
├── src/
│   ├── domain/           # Entities, VOs, Events
│   ├── application/
│   │   ├── use-cases/    # Business logic
│   │   ├── ports/        # Interfaces (IXxxRepository, IXxxProvider)
│   │   └── dto/          # Zod schemas
│   └── adapters/
│       ├── actions/      # Server actions
│       ├── controllers/  # HTTP handlers
│       ├── guards/       # Auth middleware
│       ├── repositories/ # DB impl
│       ├── mappers/      # Domain ↔ DB
│       ├── queries/      # CQRS reads
│       └── services/     # External service implementations
│           ├── auth/     # Auth provider (BetterAuth)
│           ├── llm/      # LLM provider (AI SDK)
│           └── email/    # Email service
├── common/
│   ├── auth.ts           # BetterAuth config
│   └── di/               # DI container + modules
└── app/api/auth/[...all]/ # BetterAuth route
```

**Adapters organization:**
- `services/` - All external service implementations grouped together (auth, llm, email, etc.)
- Each service in its own subfolder under `services/`
- Avoids proliferation of top-level adapter folders

### CQRS

- **Commands**: Controller → Use Case → Domain → Repository
- **Queries**: Controller → Query (direct ORM)

## Core Patterns (ddd-kit)

### Result<T,E>

```typescript
Result.ok(value)              // Success
Result.fail(error)            // Failure
Result.combine([r1, r2, r3])  // First failure or ok()

result.isSuccess / result.isFailure
result.getValue()  // throws if failure
result.getError()  // throws if success
```

### Option<T>

```typescript
Option.some(value)            // Some<T>
Option.none()                 // None<T>
Option.fromNullable(value)    // Some if value, None if null

option.isSome() / option.isNone()
option.unwrap()               // throws if None
option.unwrapOr(default)
option.map(fn) / option.flatMap(fn)
match(option, { Some: v => ..., None: () => ... })
```

### ValueObject<T>

```typescript
export class Email extends ValueObject<string> {
  protected validate(value: string): Result<string> {
    if (!value.includes('@')) return Result.fail('Invalid email')
    return Result.ok(value)
  }
}

const result = Email.create('test@example.com')  // Result<Email>
email.value  // 'test@example.com'
```

### Entity & Aggregate

```typescript
export class UserId extends UUID<string | number> {
  protected [Symbol.toStringTag] = "UserId";
  static create(id: UUID<string | number>): UserId { return new UserId(id.value); }
}

export class User extends Aggregate<IUserProps> {
  get id(): UserId { return UserId.create(this._id) }  // Only getter needed!

  static create(props, id?): User {
    return new User({ ...props, createdAt: new Date() }, id ?? new UUID());
  }

  updateName(name: Name): void {
    this._props.name = name;
    this._props.updatedAt = new Date();
  }
}

// Entity API - use get() for property access, NOT custom getters
entity.get('propertyName')  // Returns typed property value
entity._id / entity._props  // Direct access (internal use)
entity.getProps() / entity.toObject() / entity.clone({...})

// Aggregate API
aggregate.domainEvents / aggregate.addEvent(e) / aggregate.clearEvents()
```

**Minimal getters pattern:** Only define `get id()` getter. Access all other properties via `entity.get('propName')` method inherited from Entity/Aggregate base class.

### BaseRepository<T>

```typescript
interface BaseRepository<T> {
  create(entity, trx?): Promise<Result<T>>
  update(entity, trx?): Promise<Result<T>>
  delete(id, trx?): Promise<Result<id>>
  findById(id): Promise<Result<Option<T>>>
  findAll(pagination?): Promise<Result<PaginatedResult<T>>>
  findMany(props, pagination?): Promise<Result<PaginatedResult<T>>>
  findBy(props): Promise<Result<Option<T>>>
  exists(id): Promise<Result<boolean>>
  count(): Promise<Result<number>>
}

// Pagination
interface PaginationParams { page: number; limit: number }
interface PaginatedResult<T> {
  data: T[];
  pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
}
const DEFAULT_PAGINATION = { page: 1, limit: 20 }
createPaginatedResult(data, params, total)  // Helper
```

### Use Cases

```typescript
export class SignInUseCase implements UseCase<Input, Output> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authProvider: IAuthProvider,
  ) {}

  async execute(input): Promise<Result<Output>> {
    const emailResult = Email.create(input.email);
    const passwordResult = Password.create(input.password);
    const combined = Result.combine([emailResult, passwordResult]);
    if (combined.isFailure) return Result.fail(combined.getError());

    const userResult = await this.checkUserExists(emailResult.getValue());
    if (userResult.isFailure) return Result.fail(userResult.getError());

    const authResult = await this.authProvider.signIn(userResult.getValue(), passwordResult.getValue());
    if (authResult.isFailure) return Result.fail(authResult.getError());

    return Result.ok(this.toDto(authResult.getValue()));
  }

  private async checkUserExists(email: Email): Promise<Result<User>> {
    const result = await this.userRepo.findByEmail(email.value);
    if (result.isFailure) return Result.fail(result.getError());

    return match<User, Result<User>>(result.getValue(), {
      Some: (user) => Result.ok(user),
      None: () => Result.fail("Email not found"),
    });
  }

  private toDto(response): Output { /* map to DTO */ }
}
```

### DTOs

Common schemas in `dto/common.dto.ts`, feature DTOs compose them:

```typescript
// common.dto.ts
export const userDtoSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });

// sign-in.dto.ts
export const signInInputDtoSchema = z.object({ email: z.email(), password: z.string().min(8) });
export const signInOutputDtoSchema = z.object({ user: userDtoSchema, token: z.string() });
export type ISignInInputDto = z.infer<typeof signInInputDtoSchema>;
```

### Ports

```typescript
export interface IAuthProvider {
  signIn(user: User, password: Password): Promise<Result<AuthResponse>>;
  signUp(user: User, password: Password): Promise<Result<AuthResponse>>;
  signOut(headers: Headers): Promise<Result<void>>;
  getSession(headers: Headers): Promise<Result<Option<AuthSession>>>;
}
```

### DI

```typescript
// modules/auth.module.ts
export const createAuthModule = () => {
  const m = createModule();
  m.bind(DI_SYMBOLS.IUserRepository).toClass(DrizzleUserRepository);
  m.bind(DI_SYMBOLS.SignInUseCase).toClass(SignInUseCase, [DI_SYMBOLS.IUserRepository, DI_SYMBOLS.IAuthProvider]);
  return m;
};

// Usage
const useCase = getInjection("SignInUseCase");
```

### Guards

```typescript
export async function requireAuth(redirectTo = "/login"): Promise<IGetSessionOutputDto> {
  const headersList = await headers();
  const useCase = getInjection("GetSessionUseCase");
  const result = await useCase.execute(headersList);

  if (result.isFailure) redirect(redirectTo);

  return match<IGetSessionOutputDto, IGetSessionOutputDto>(result.getValue(), {
    Some: (session) => session,
    None: () => redirect(redirectTo),
  });
}
```

## Key Rules

1. **Domain = zero external imports** (only ddd-kit + Zod)
2. **Never throw** in Domain/Application → use Result<T>
3. **Never null** → use Option<T>
4. **VOs use Zod** for validation
5. **Transactions** managed in controllers, passed to use cases
6. **All deps injected** via DI
7. **No index.ts barrels** → import directly
8. **No comments** → self-documenting code
9. **Only `get id()` getter** → Use `entity.get('propName')` method for all property access. No other getters needed.

## Templates

### Aggregate Template

```typescript
// src/domain/{name}/{name}.aggregate.ts
import { Aggregate, UUID } from "@packages/ddd-kit";
import { {Name}Id } from "./{name}-id";
import { {Name}CreatedEvent } from "./events/{name}-created.event";

interface I{Name}Props {
  // Add properties
  createdAt: Date;
  updatedAt?: Date;
}

export class {Name} extends Aggregate<I{Name}Props> {
  get id(): {Name}Id {
    return {Name}Id.create(this._id);
  }

  // No other getters - use this.get('propName') or entity.get('propName')

  static create(
    props: Omit<I{Name}Props, "createdAt" | "updatedAt">,
    id?: UUID
  ): {Name} {
    const entity = new {Name}(
      { ...props, createdAt: new Date() },
      id ?? new UUID()
    );
    entity.addEvent(new {Name}CreatedEvent(entity));
    return entity;
  }

  static reconstitute(props: I{Name}Props, id: UUID): {Name} {
    return new {Name}(props, id);
  }

  // Add methods that modify state
}
```

### Value Object Template

```typescript
// src/domain/{aggregate}/value-objects/{name}.vo.ts
import { ValueObject, Result } from "@packages/ddd-kit";
import { z } from "zod";

const schema = z.string().min(1).max(100);

export class {Name} extends ValueObject<string> {
  protected validate(value: string): Result<string> {
    const result = schema.safeParse(value);
    if (!result.success) {
      return Result.fail(result.error.errors[0].message);
    }
    return Result.ok(result.data);
  }
}
```

### UseCase Template

```typescript
// src/application/use-cases/{domain}/{name}.use-case.ts
import { UseCase, Result, match } from "@packages/ddd-kit";
import type { IEventDispatcher } from "@/application/ports/event-dispatcher.port";
import type { I{Name}InputDto, I{Name}OutputDto } from "@/application/dto/{domain}/{name}.dto";

export class {Name}UseCase implements UseCase<I{Name}InputDto, I{Name}OutputDto> {
  constructor(
    private readonly repo: IRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async execute(input: I{Name}InputDto): Promise<Result<I{Name}OutputDto>> {
    // 1. Validate & create VOs
    // 2. Business logic
    // 3. Persist
    // 4. Dispatch events
    // 5. Return DTO
  }
}
```

### Test Template

```typescript
// src/application/use-cases/{domain}/__tests__/{name}.use-case.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Result, Option } from "@packages/ddd-kit";

describe("{Name}UseCase", () => {
  let useCase: {Name}UseCase;
  let mockRepo: MockRepo;
  let mockEventDispatcher: IEventDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = { method: vi.fn() };
    mockEventDispatcher = { dispatch: vi.fn(), dispatchAll: vi.fn() };
    useCase = new {Name}UseCase(mockRepo, mockEventDispatcher);
  });

  describe("happy path", () => {
    it("should {action} when {condition}", async () => {
      // Arrange
      mockRepo.method.mockResolvedValue(Result.ok(value));

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isSuccess).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("should fail when {field} is invalid", async () => {
      const result = await useCase.execute({ ...input, field: "invalid" });
      expect(result.isFailure).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should fail when repository returns error", async () => {
      mockRepo.method.mockResolvedValue(Result.fail("Database error"));
      const result = await useCase.execute(input);
      expect(result.isFailure).toBe(true);
    });
  });
});
```

### Domain Event Template

```typescript
// src/domain/{aggregate}/events/{name}.event.ts
import { BaseDomainEvent } from "@packages/ddd-kit";

interface I{Name}EventPayload {
  aggregateId: string;
  // Add payload fields
}

export class {Name}Event extends BaseDomainEvent<I{Name}EventPayload> {
  readonly eventType = "{aggregate}.{action}";

  constructor(aggregate: {Aggregate}) {
    super();
    this.aggregateId = aggregate.id.value;
    this.payload = {
      aggregateId: aggregate.id.value,
      // Map payload fields
    };
  }
}
```

## Testing: BDD

Test behaviors via Use Cases, not units.

```typescript
describe('CreateUserUseCase', () => {
  const mockUserRepo: IUserRepository = { create: vi.fn(), findByEmail: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks();
    container.bind('IUserRepository').toConstant(mockUserRepo);
  })

  it('should create user when email is unique', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(Result.ok(Option.none()));
    mockUserRepo.create.mockResolvedValue(Result.ok(mockUser));

    const result = await getInjection('CreateUserUseCase').execute({ email: 'new@test.com' });

    expect(result.isSuccess).toBe(true);
    expect(mockUserRepo.create).toHaveBeenCalledOnce();
  })
})
```

**Rules**: One file per Use Case • Mock at repository level • Test Result/Option states • Name as behaviors

## Page Structure

Pages = orchestration only. Logic in `_components/`.

```
app/(auth)/login/
├── page.tsx              # Composes LoginForm
└── _components/
    └── login-form.tsx    # Client component with logic
```

```typescript
// page.tsx - Server Component
export default async function DashboardPage() {
  const session = await requireAuth();
  return <ProfileCard user={session.user} />;
}
```

**Rules**: Pages compose • Logic in _components • Server by default • Guards in layouts

## UI

**shadcn/ui first**: `pnpm ui:add button form input`

```
packages/ui/src/components/ui/  # shadcn (auto-generated)
```

## Monorepo

- `apps/nextjs/` - Web + API
- `packages/ddd-kit/` - DDD primitives
- `packages/drizzle/` - DB schema
- `packages/ui/` - Shared components

## Environment

`.env`: `DATABASE_URL` - PostgreSQL connection

## Development Workflow

### Interactive Flow

```
┌─────────────────┐
│   Feature PRD   │  /feature-prd
│  (Discovery +   │  → EventStorming + Structured PRD
│   Specification)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Domain Layer   │  /gen-domain
│  (Aggregates)   │  → Entities, VOs, Events
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Application     │  /gen-usecase
│  (Use Cases)    │  → UseCases, DTOs, DI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Testing      │  /gen-tests
│  (BDD Tests)    │  → Comprehensive tests
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Validation    │  pnpm check:all
│  (Quality)      │  → lint, types, tests, duplication
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Deploy       │  git commit && git push
│  (Production)   │  → CI/CD
└─────────────────┘
```

### Autonomous Flow (Ralph Wiggum)

For complex features, use the autonomous agent loop:

```
┌─────────────────┐
│   Feature PRD   │  /feature-prd
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Create Plan   │  /create-plan
│  (plan.md +     │  → JSON tasks + PROMPT.md
│   PROMPT.md)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Activity │  /create-activity
│  (activity.md)  │  → Session log template
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│      Autonomous Agent Loop      │
│  ┌────────────────────────────┐ │
│  │ Read activity.md (state)   │ │
│  └─────────────┬──────────────┘ │
│                │                │
│                ▼                │
│  ┌────────────────────────────┐ │
│  │ Find next task in plan.md │ │
│  │     (passes: false)        │ │
│  └─────────────┬──────────────┘ │
│                │                │
│                ▼                │
│  ┌────────────────────────────┐ │
│  │ Complete task steps        │ │
│  │ Update plan.md + log       │ │
│  │ Git commit                 │ │
│  └─────────────┬──────────────┘ │
│                │                │
│                ▼                │
│           [Repeat]              │
└─────────────────────────────────┘
```

### Step Details

#### 1. Feature PRD
Conversational domain discovery:
- EventStorming (Events, Commands, Aggregates, Policies)
- 10 essential aspects covered
- Structured PRD with implementation checklist

#### 2. Domain Layer
Generated files:
- `src/domain/{feature}/{feature}.aggregate.ts`
- `src/domain/{feature}/value-objects/*.vo.ts`
- `src/domain/{feature}/events/*.event.ts`

#### 3. Application Layer
Generated files:
- `src/application/use-cases/{feature}/*.use-case.ts`
- `src/application/dto/{feature}/*.dto.ts`
- `common/di/modules/{feature}.module.ts`

#### 4. Testing
Generated files:
- `src/application/use-cases/{feature}/__tests__/*.test.ts`

#### 5. Validation
Quality checks:
- `pnpm check` - Code style
- `pnpm type-check` - TypeScript
- `pnpm test` - All tests
- `pnpm check:duplication` - No copy-paste
- `pnpm check:unused` - No dead code

## Skills Reference

### /feature-prd
**Purpose:** Conversational PRD with EventStorming discovery

**Usage:**
```
/feature-prd
```

**Process:**
1. EventStorming discovery (Events, Commands, Aggregates, Policies)
2. Feature deep dive (10 essential aspects)
3. Technology research (WebSearch, Context7)
4. PRD generation with implementation checklist

**Output:** Comprehensive PRD with domain model, use cases, API, file locations

---

### /create-plan
**Purpose:** Generate plan.md + PROMPT.md for autonomous workflow

**Usage:**
```
/create-plan
```

**Output:**
- `plan.md` - JSON task list with steps and passes:false/true
- `PROMPT.md` - Agent instructions for Ralph Wiggum loop

---

### /create-activity
**Purpose:** Initialize activity.md for session logging

**Usage:**
```
/create-activity
```

**Output:** `activity.md` with status tracking and session log template

---

### /gen-domain
**Purpose:** Generate domain layer code

**Usage:**
```
/gen-domain [Aggregate] with [properties]
```

**Output:** Aggregate, VOs, Events files

**Example:**
```
/gen-domain Notification with userId, type, message, readAt
```

---

### /gen-usecase
**Purpose:** Generate use case with DTOs and DI

**Usage:**
```
/gen-usecase [UseCaseName]: [description]
```

**Output:** UseCase, DTOs, DI registration

**Example:**
```
/gen-usecase MarkNotificationRead: marks a notification as read for user
```

---

### /gen-tests
**Purpose:** Generate BDD tests for use case

**Usage:**
```
/gen-tests [UseCaseName]
```

**Output:** Comprehensive test file

---

### /feature
**Purpose:** Generate complete feature from discovery to validation (Lovable-like experience)

**Usage:**
```
/feature "Users can bookmark articles"
```

**Process:**
1. Discovery (EventStorming, business rules)
2. Domain Layer (TDD - tests first)
3. Application Layer (TDD - tests first)
4. Infrastructure (schema, DI)
5. Adapters (repository, actions, handlers)
6. UI (pages, components, forms)
7. Validation (tests, types, lint)

**Output:** Complete working feature with all layers

---

### /gen-query
**Purpose:** Generate CQRS read model queries

**Usage:**
```
/gen-query GetUserDashboard for User domain
```

**Output:** Query class with direct ORM access, DTOs

**When to use:** Dashboard stats, list views, reports (read-only, no domain logic)

---

### /gen-action
**Purpose:** Generate Next.js server actions

**Usage:**
```
/gen-action Bookmark feature
```

**Output:** Server actions with input validation, DI injection, ActionResult wrapper

---

### /gen-route
**Purpose:** Generate API routes and controllers

**Usage:**
```
/gen-route Bookmark resource
```

**Output:** Route handlers + controllers with auth guards, validation, error mapping

---

### /gen-handler
**Purpose:** Generate domain event handlers

**Usage:**
```
/gen-handler SendWelcomeEmail for UserCreatedEvent
```

**Output:** Event handler implementing IEventHandler interface, DI registration

---

### /gen-page
**Purpose:** Generate Next.js pages and components

**Usage:**
```
/gen-page Bookmarks list (protected)
```

**Output:** Page + _components with server/client split, auth guards

---

### /gen-form
**Purpose:** Generate React Hook Form with Zod validation

**Usage:**
```
/gen-form CreateBookmark with title, url, description
```

**Output:** Form component with shadcn/ui, server action integration

---

### /resume
**Purpose:** Resume interrupted workflow from checkpoint

**Usage:**
```
/resume
```

**Process:** Reads activity.md and plan.md, diagnoses failure, continues from checkpoint

## Agents Reference

### feature-architect
**Purpose:** Design feature architecture before implementation

**When to use:**
- Starting a new feature
- Unsure about structure
- Want to follow existing patterns

**What it does:**
1. Analyzes existing codebase patterns
2. Proposes file structure
3. Identifies needed components
4. Creates implementation blueprint

**Invoke:**
```
Use the feature-architect agent to design [feature name]
```

---

### code-reviewer
**Purpose:** Review code for issues before commit

**When to use:**
- After implementing feature
- Before creating PR
- Want quality check

**What it does:**
1. Checks Clean Architecture compliance
2. Verifies DDD patterns
3. Finds bugs and code smells
4. Suggests improvements

**Invoke:**
```
Use the code-reviewer agent to review [file or feature]
```

**Output:** Issues by severity with fixes

---

### test-writer
**Purpose:** Generate comprehensive tests

**When to use:**
- After implementing use case
- Need more test coverage
- Want BDD-style tests

**What it does:**
1. Analyzes implementation
2. Identifies all code paths
3. Writes comprehensive tests
4. Covers edge cases

**Invoke:**
```
Use the test-writer agent to write tests for [use case]
```

---

### doc-writer
**Purpose:** Update documentation

**When to use:**
- After adding feature
- After changing patterns
- README needs update

**What it does:**
1. Identifies affected docs
2. Updates CLAUDE.md sections
3. Updates README
4. Keeps examples current

**Invoke:**
```
Use the doc-writer agent to update docs for [feature]
```

## Decision Trees

### Entity vs Aggregate

```
Does it have a unique identity?
├─ No → Value Object
└─ Yes → Does it own other entities?
         ├─ No → Entity
         └─ Yes → Does it need domain events?
                  ├─ No → Entity (root of group)
                  └─ Yes → Aggregate
```

**Examples:**
- Email → Value Object (no identity)
- Address → Entity (identity, no children)
- User → Aggregate (has identity, owns sessions, emits events)
- Order → Aggregate (owns OrderItems, emits events)

---

### Result vs Option

```
Can the operation fail with an error message?
├─ Yes → Result<T>
│        └─ Multiple failure reasons? → Result<T, ErrorEnum>
└─ No → Is the value optional/nullable?
        ├─ Yes → Option<T>
        └─ No → Plain T
```

**Examples:**
- `Email.create()` → `Result<Email>` (can fail: invalid format)
- `findById()` → `Result<Option<User>>` (can fail: DB error, can be missing)
- `user.name` → `Name` (required, validated at creation)
- `user.bio` → `Option<Bio>` (optional, no error if missing)

---

### When to Emit Domain Events

```
Is this a significant business state change?
├─ No → Don't emit
└─ Yes → Should other parts of system react?
         ├─ No → Don't emit
         └─ Yes → Emit event
                  └─ Dispatch AFTER repository.save()
```

**Emit for:**
- User registration (send welcome email)
- Subscription created (provision resources)
- Payment failed (notify user)

**Don't emit for:**
- User updated name (no side effects)
- Internal state changes

---

### Repository vs Query

```
Need to modify data?
├─ Yes → Repository (through Use Case)
└─ No → Need domain logic?
        ├─ Yes → Repository (returns Aggregate)
        └─ No → Is this a simple read?
                ├─ Yes → Query (direct ORM)
                └─ No → Repository + DTO
```

**Use Repository when:**
- Creating/updating entities
- Need to apply business rules
- Need aggregate with full state

**Use Query when:**
- Dashboard statistics
- List views with filters
- Reports
- No business logic needed

---

### CQRS Decision

```
Command or Query?

Command (write):
Controller → UseCase → Aggregate → Repository
                            ↓
                   EventDispatcher → Handlers

Query (read):
Controller → Query → Database
                ↓
            DTO Response
```

## Domain Events

### Overview

Domain events capture significant business state changes. They enable:
- Loose coupling between components
- Side effects (emails, notifications)
- Audit logging
- Event-driven workflows

### Event Structure

```typescript
// src/domain/user/events/user-created.event.ts
export class UserCreatedEvent extends DomainEvent<{
  userId: string;
  email: string;
  name: string;
}> {
  readonly eventType = "user.created";

  constructor(user: User) {
    super();
    this.aggregateId = user.id.value;
    this.payload = {
      userId: user.id.value,
      email: user.email.value,
      name: user.name.value,
    };
  }
}
```

### Emitting Events

Events are added in aggregate methods, NOT dispatched:

```typescript
// In aggregate
static create(props: CreateProps): User {
  const user = new User({ ...props, createdAt: new Date() }, new UUID());
  user.addEvent(new UserCreatedEvent(user)); // Added, not dispatched!
  return user;
}

verifyEmail(): void {
  this._props.emailVerified = true;
  this.addEvent(new UserEmailVerifiedEvent(this));
}
```

### Dispatching Events

**CRITICAL:** Events dispatch AFTER successful persistence:

```typescript
// In use case
async execute(input: Input): Promise<Result<Output>> {
  // 1. Create aggregate (events added internally)
  const user = User.create(props);

  // 2. Persist FIRST
  const saveResult = await this.userRepo.create(user);
  if (saveResult.isFailure) {
    return Result.fail(saveResult.getError());
    // Events NOT dispatched on failure!
  }

  // 3. Dispatch AFTER save succeeds
  await this.eventDispatcher.dispatchAll(user.domainEvents);
  user.clearEvents();

  return Result.ok(dto);
}
```

### Event Handlers

```typescript
// src/application/event-handlers/send-welcome-email.handler.ts
export class SendWelcomeEmailHandler implements IEventHandler<UserCreatedEvent> {
  readonly eventType = "user.created";

  constructor(private readonly emailService: IEmailService) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    await this.emailService.sendWelcomeEmail({
      to: event.payload.email,
      name: event.payload.name,
    });
  }
}
```

### Event Flow Diagram

```
User.create()
    │
    ▼
addEvent(UserCreatedEvent)
    │
    ▼
userRepo.create(user)  ──────► DB Insert
    │
    │ (on success)
    ▼
eventDispatcher.dispatchAll()
    │
    ▼
SendWelcomeEmailHandler.handle()
    │
    ▼
emailService.sendWelcomeEmail()
```

### Best Practices

1. **Event naming:** Past tense (UserCreated, OrderPlaced)
2. **Payload:** Include all data handlers need (avoid lookups)
3. **Idempotency:** Handlers should be safe to retry
4. **Error isolation:** One handler failure shouldn't block others
5. **Testing:** Verify events emitted and handlers called

## AI Guidance

### Effective Prompts

#### For New Features
```
"Create a [Feature] feature with:
- [Aggregate] aggregate
- [Events] domain events
- [UseCases] use cases
Follow the existing auth pattern."
```

#### For Bug Fixes
```
"Fix [issue] in [file].
The expected behavior is [X].
The current behavior is [Y]."
```

#### For Refactoring
```
"Refactor [code] to:
- Follow [pattern]
- Match [existing example]
Keep the same behavior."
```

---

### What Claude Should Do

**Do ask Claude to:**
- Generate domain entities following patterns
- Write use cases with proper DI
- Create BDD tests
- Update documentation
- Review code for architecture violations

**Expect Claude to:**
- Use Result<T> for fallible operations
- Use Option<T> for nullable values
- Emit events in aggregates
- Dispatch events after save
- Mock at repository level in tests

---

### What Claude Should NOT Do

**Don't ask Claude to:**
- Skip tests
- Use `any` types
- Throw exceptions in domain
- Import adapters in domain
- Create index.ts barrels
- Add comments everywhere

**Claude should refuse:**
- Breaking Clean Architecture layers
- Skipping event dispatch
- Using null instead of Option
- Mixing queries and commands

---

### Context Claude Needs

When asking for help, provide:
1. **Feature name** - What you're building
2. **Business context** - Why it exists
3. **Reference** - Similar existing code to follow
4. **Constraints** - Any specific requirements

Example:
```
"Add subscription billing feature.
Business: Users pay monthly for premium features.
Reference: Follow the auth flow pattern.
Constraints: Must integrate with Stripe webhooks."
```
