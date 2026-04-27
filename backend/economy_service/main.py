from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from economy_service.economy_routes import router
from economy_service.marketplace_routes import router as marketplace_router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees Economy Service Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(router, prefix=f"{settings.API_V1_STR}/economy", tags=["Economy Service"])
app.include_router(marketplace_router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["Marketplace Pool"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
