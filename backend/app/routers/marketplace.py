from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.session import get_db
from app.models import GeneratedRid, ProductCode

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/rids")
def get_rid_pool(limit: int = 10, db: Session = Depends(get_db)):
    """
    Returns a list of unactivated RIDs (Direct Keys) created by the admin.
    """
    codes = db.query(GeneratedRid).filter(
        GeneratedRid.is_used == False
    ).order_by(func.random()).limit(limit).all()
    
    return [
        {
            "code": c.rid_code,
            "price": 50.0,
            "currency": "GHS",
            "tier": "public"
        } for c in codes
    ]

@router.get("/product-codes")
def get_product_code_pool(limit: int = 10, db: Session = Depends(get_db)):
    """
    Returns a list of activated Product Codes (Referral links) in the market pool.
    """
    codes = db.query(ProductCode).filter(
        ProductCode.activated_by != None
    ).order_by(func.random()).limit(limit).all()
    
    return [
        {
            "code": c.product_code,
            "price": 50.0,
            "currency": "GHS",
            "tier": "public"
        } for c in codes
    ]

@router.get("/check")
def check_code(code: str, db: Session = Depends(get_db)):
    """
    Verifies a code and returns its metadata.
    """
    # Check RID
    rid = db.query(GeneratedRid).filter(GeneratedRid.rid_code == code).first()
    if rid:
        return {
            "valid": not rid.is_used,
            "type": "rid",
            "price": 50.0,
            "currency": "GHS"
        }
    
    # Check Product Code
    pc = db.query(ProductCode).filter(ProductCode.product_code == code).first()
    if pc:
        return {
            "valid": True,
            "type": "product_code",
            "price": 50.0,
            "currency": "GHS"
        }
    
    return {"valid": False, "error": "Code not found"}

@router.get("/currencies")
def get_rates():
    from app.services.currency_engine import currency_engine
    return {
        "currencies": currency_engine.get_supported_currencies(),
        "rates": currency_engine.RATES
    }
