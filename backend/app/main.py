from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import engine
from app.models import Base

# Import routers
from app.routers import auth, activation, wallet, withdrawal, network, dashboard, codes, admin, seasons, marketplace, payments

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "traceback": traceback.format_exc()}
        )

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(activation.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(withdrawal.router, prefix="/api/v1")
app.include_router(network.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(codes.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(seasons.router, prefix="/api/v1")
app.include_router(marketplace.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the EarNnLearn API"}
