from fastapi import FastAPI
from wallet_service.wallet_routes import router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees Wallet Service Service")

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(router, prefix=f"{settings.API_V1_STR}/wallet", tags=["Wallet Service"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
