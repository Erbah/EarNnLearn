from fastapi import FastAPI
from creator_service.creator_routes import router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees Creator Service Service")

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(router, prefix=f"{settings.API_V1_STR}/creator", tags=["Creator Service"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
