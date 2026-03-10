import os
from contextlib import asynccontextmanager

import pandas as pd
from dotenv import load_dotenv

if not hasattr(pd.DataFrame, "applymap"):
    pd.DataFrame.applymap = pd.DataFrame.map

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ai_actions, financial, listing, price, screening
from routers.dnse import router as dnse_router
from routers.fund import router as fund_router
from routers.market_watch import router as market_watch_router
from routers.youtube import router as youtube_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from jobs.scheduler import start_scheduler

    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="AI Finance Stock Service",
    description="Vietnam stock market data and AI analysis workflows",
    version="0.1.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price.router, prefix="/api/price", tags=["Price"])
app.include_router(financial.router, prefix="/api/financial", tags=["Financial"])
app.include_router(screening.router, prefix="/api/screening", tags=["Screening"])
app.include_router(listing.router, prefix="/api/listing", tags=["Listing"])
app.include_router(ai_actions.router, prefix="/api/ai", tags=["AI Actions"])
app.include_router(market_watch_router, prefix="/api/market-watch", tags=["Market Watch"])
app.include_router(dnse_router, prefix="/api/dnse", tags=["DNSE"])
app.include_router(youtube_router, prefix="/api/youtube", tags=["YouTube"])
app.include_router(fund_router, prefix="/api/fund", tags=["Fund"])


@app.get("/health")
async def health():
    vnstock_ok = False
    try:
        from vnstock import Vnstock
        vnstock_ok = True
    except ImportError:
        pass
    return {"status": "ok", "service": "stock-service", "vnstock": vnstock_ok}
