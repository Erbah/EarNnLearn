from fastapi import FastAPI
from auth_service.auth_routes import router as auth_router
from common.core.config import settings
from common.database.db_session import Base, engine
import common.models  # Ensure all models are loaded for metadata

app = FastAPI(title="CediTrees Auth Service")

# Create tables if not exists (in microservices, migrations are better, 
# but we keep the auto-create for dev parity)
Base.metadata.create_all(bind=engine)

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
