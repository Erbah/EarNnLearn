from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/codes", tags=["codes"])

class GenerateRidRequest(BaseModel):
    count: int

@router.post("/generate-rid")
def generate_rid(request: GenerateRidRequest):
    return {"rids": [f"ACNIRPc{i}" for i in range(1, request.count + 1)]}

@router.get("/my-products")
def get_my_products():
    return [
        {"product_code": "ACNIRPc1c2c1c3c4c1", "created_at": "2026-03-11"}
    ]
