from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from learning_service.learning_routes import router
from common.core.config import settings
from common.database.db_session import engine, Base

app = FastAPI(title="CediTrees Learning Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine)

app.include_router(router, prefix=f"{settings.API_V1_STR}/learn", tags=["Learning & Gamification"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
