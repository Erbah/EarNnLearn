from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.payment_simulator import simulator

router = APIRouter(prefix="/payments", tags=["payments"])

class SimulationRequest(BaseModel):
    amount: float
    currency: str = "GHS"

@router.post("/simulate/initialize")
async def initialize_payment(req: SimulationRequest):
    """
    Simulates a user starting a payment process.
    """
    reference = simulator.create_mock_payment(req.amount, req.currency)
    return {"reference": reference, "status": "pending"}

@router.get("/verify/{reference}")
async def verify_payment(reference: str):
    """
    Checks the status of a payment reference.
    """
    status_data = simulator.get_status(reference)
    if status_data["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Payment reference not found")
    return status_data

@router.post("/simulate/callback/{reference}")
async def simulate_callback(reference: str):
    """
    Simulates a webhook callback from a payment gateway.
    """
    try:
        transaction_id = simulator.complete_payment(reference)
        return {"message": "Payment successful", "transaction_id": transaction_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
