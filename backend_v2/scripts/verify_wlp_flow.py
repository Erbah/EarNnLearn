import os
import sys

# Force testing mode so it doesn't make real HTTP calls to Paystack
os.environ["TESTING"] = "True"

# Ensure backend_v2 is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.core.database import SessionLocal, Base, engine
from main import app
from app.models.user import User
from app.models.wallet import Wallet, WithdrawalRequest
from app.models.admin import SystemSetting
from decimal import Decimal
import time

# Create clean tables for the test
Base.metadata.create_all(bind=engine)

def test_wlp_flow():
    db = SessionLocal()
    client = TestClient(app)
    
    try:
        print("--- Starting WLP Flow Test ---")
        
        # 1. Setup Data
        # Ensure setting is ON
        setting = db.query(SystemSetting).filter(SystemSetting.key == 'automated_withdrawals').first()
        if not setting:
            db.add(SystemSetting(key='automated_withdrawals', value='true'))
        else:
            setting.value = 'true'
            
        limit_setting = db.query(SystemSetting).filter(SystemSetting.key == 'max_auto_withdrawal').first()
        if not limit_setting:
            db.add(SystemSetting(key='max_auto_withdrawal', value='500.00'))
            
        # Create a test user
        user = db.query(User).filter(User.rid == "TESTWLP.1").first()
        if not user:
            user = User(
                email="wlp_tester@example.com",
                password_hash="hashedpassword",
                name="WLP Tester",
                rid="TESTWLP.1",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        # Create wallet with funds
        wallet = db.query(Wallet).filter(Wallet.user_rid == user.rid).first()
        if not wallet:
            wallet = Wallet(
                user_rid=user.rid,
                balance=Decimal("2000.00"),
                withdrawable_balance=Decimal("2000.00")
            )
            db.add(wallet)
            db.commit()
        else:
            wallet.balance = Decimal("2000.00")
            wallet.withdrawable_balance = Decimal("2000.00")
            db.commit()
            
        print("1. Set up test user with 2000 GHS withdrawable balance.")
        
        from app.core.security import create_access_token
        from datetime import timedelta
        access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=15))
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # 2. Trigger the withdrawal from the 'frontend' (AMOUNT > 500)
        print("2. Frontend sends withdrawal request (1000 GHS via Paystack)...")
        payload = {
            "amount": 1000.00,
            "payout_method": "paystack",
            "payout_details": {
                "name": "Kwame Mensah",
                "account_number": "0241234567",
                "bank_code": "MTN"
            }
        }
        
        response = client.post("/api/v1/wallet/withdraw", json=payload, headers=headers)
        
        # 3. Assertions and Results
        if response.status_code != 200:
            print(f"FAILED POST /withdraw: API returned {response.status_code}")
            print(response.json())
            return
            
        data = response.json()
        print(f"API Response Status: {data.get('status')} (Expected: AWAITING_WLP)")
        request_id = data.get("id")
        
        # Check DB for WLP code
        req = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == request_id).first()
        print(f"Generated WLP Code: {req.wlp_code}")
        
        # 4. Trigger WLP verification
        print(f"3. Frontend submits the WLP Code ({req.wlp_code}) to verification endpoint...")
        verify_payload = {
            "wlp_code": req.wlp_code
        }
        
        verify_response = client.post(f"/api/v1/wallet/withdraw/{request_id}/verify-wlp", json=verify_payload, headers=headers)
        
        if verify_response.status_code != 200:
            print(f"FAILED POST /verify-wlp: API returned {verify_response.status_code}")
            print(verify_response.json())
            return
            
        verify_data = verify_response.json()
        
        # Check DB to see what happened
        db.refresh(req)
        
        print("\n--- RESULTS ---")
        print(f"Withdrawal Status: {req.status} (Expected: APPROVED)")
        print(f"Admin Notes: {req.admin_notes}")
        
        if req.status == "APPROVED" and "WLP Verified" in req.admin_notes:
            print("\n✅ TEST PASSED: The system generated a WLP code, verified it, and successfully approved the payout!")
        else:
            print("\n❌ TEST FAILED: The WLP flow did not approve the transaction.")
            
    except Exception as e:
        print(f"Error during test: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_wlp_flow()
