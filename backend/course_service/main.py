from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from course_service.course_routes import router
from learning_service.learning_routes import router as gamification_router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees Course Service Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(router, prefix=f"{settings.API_V1_STR}/learn", tags=["Learning Service"])
app.include_router(gamification_router, prefix=f"{settings.API_V1_STR}/learn", tags=["Gamification"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
