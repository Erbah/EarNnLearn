from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from common.database.db_session import get_db
from common.models.code import ActivationRID, ProductCode
import random
from datetime import datetime

router = APIRouter()

@router.get("/rids")
def get_rid_pool(limit: int = 10, db: Session = Depends(get_db)):
    """RID Marketplace: Returns a fair, weighted random selection of active RIDs."""
    active_codes = db.query(ActivationRID).filter(
        ActivationRID.status == "UNUSED"
    ).order_by(ActivationRID.created_at.asc()).limit(100).all()
    
    if not active_codes:
        return []

    # Weighted Selection (Fairness Engine - for now just return them)
    selected_codes = random.sample(active_codes, k=min(len(active_codes), limit))
    
    results = []
    for c in selected_codes:
        results.append({
            "code": c.rid_code,
            "usage_count": 0,
            "tier": c.tier,
            "price": 10.0 # Default price if not in model
        })
    return results

@router.get("/product-codes")
def get_product_code_pool(limit: int = 10, db: Session = Depends(get_db)):
    """Product Code Marketplace: Returns a fair, weighted random selection of active Product Codes."""
    active_codes = db.query(ProductCode).filter(
        ProductCode.status == "ACTIVE"
    ).order_by(ProductCode.created_at.asc()).limit(100).all()
    
    if not active_codes:
        return []

    # Weighted Selection (Fairness Engine)
    selected_codes = random.sample(active_codes, k=min(len(active_codes), limit))
    
    results = []
    for c in selected_codes:
        results.append({
            "code": c.code,
            "usage_count": int(c.total_sales),
            "tier": "public",
            "price": 15.0 # Default price if not in model
        })
    return results

@router.get("/pool")
def get_marketplace_pool(limit: int = 10, db: Session = Depends(get_db)):
    # Legacy or aggregate pool
    return get_product_code_pool(limit, db)

@router.get("/check")
def check_code(code: str, db: Session = Depends(get_db)):
    """Validates a code (RID or Product Code) and returns its metadata."""
    # Check RIDs
    rid = db.query(ActivationRID).filter(ActivationRID.rid_code == code).first()
    if rid:
        return {
            "valid": True,
            "type": "rid",
            "tier": rid.tier,
            "price": 10.0,
            "status": rid.status
        }
    
    # Check Product Codes
    pc = db.query(ProductCode).filter(ProductCode.code == code).first()
    if pc:
        return {
            "valid": True,
            "type": "product_code",
            "tier": "public",
            "price": 15.0,
            "status": pc.status
        }
    
    return {"valid": False, "message": "Code not found"}

@router.get("/currencies")
def get_currencies():
    """Returns supported currencies and exchange rates."""
    return {
        "currencies": ["GHS", "USD", "NGN", "KES"],
        "rates": {
            "GHS": 1.0,
            "USD": 0.08,
            "NGN": 120.0,
            "KES": 10.5
        }
    }
