from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ai_actions, financial, listing, price, screening


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize scheduler for daily jobs
    # from jobs.scheduler import start_scheduler
    # start_scheduler()
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="AI Finance Stock Service",
    description="Vietnam stock market data and AI analysis workflows",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price.router, prefix="/api/price", tags=["Price"])
app.include_router(financial.router, prefix="/api/financial", tags=["Financial"])
app.include_router(screening.router, prefix="/api/screening", tags=["Screening"])
app.include_router(listing.router, prefix="/api/listing", tags=["Listing"])
app.include_router(ai_actions.router, prefix="/api/ai", tags=["AI Actions"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "stock-service"}
