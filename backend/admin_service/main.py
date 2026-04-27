from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from admin_service.admin_routes import router as admin_router
from admin_service.admin_transaction_routes import router as txn_router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees Admin Service Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Service"])
app.include_router(txn_router, prefix=f"{settings.API_V1_STR}/admin/transactions", tags=["Admin Transactions"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
