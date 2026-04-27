import traceback
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.activation_engine import activation_engine

router = APIRouter()

class ActivationRequest(BaseModel):
    activation_code: str # Generic name for RID or Product Code
    code_type: str = "rid" # "rid" or "product_code"
    payment_method: str
    payment_reference: str
    payment_account: str
    amount: float = 100.0

@router.post("/activate", tags=["activation"])
def activate_code(request: ActivationRequest, db: Session = Depends(get_db)):
    try:
        user_id = 99 # Placeholder for current user identifier via auth
        product_code = activation_engine.activate_code(
            db=db,
            user_id=user_id,
            activation_code=request.activation_code,
            code_type=request.code_type,
            payment_method=request.payment_method,
            payment_reference=request.payment_reference,
            payment_account=request.payment_account,
            amount=request.amount
        )
        return {"message": "Activation successful", "product_code": product_code}
    except ValueError as val_e:
        raise HTTPException(status_code=400, detail=str(val_e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Activation failed: {str(e)}")
