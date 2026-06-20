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

# Create clean tables for the test
Base.metadata.create_all(bind=engine)

def test_automated_payouts():
    db = SessionLocal()
    client = TestClient(app)
    
    try:
        print("--- Starting Automated Payout Test ---")
        
        # 1. Setup Data
        # Ensure setting is ON
        setting = db.query(SystemSetting).filter(SystemSetting.key == 'automated_withdrawals').first()
        if not setting:
            db.add(SystemSetting(key='automated_withdrawals', value='true'))
        else:
            setting.value = 'true'
            
        # Create a test user
        user = db.query(User).filter(User.rid == "TESTPAYOUT.1").first()
        if not user:
            user = User(
                email="payout_tester@example.com",
                password_hash="hashedpassword",
                name="Payout Tester",
                rid="TESTPAYOUT.1",
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
                balance=Decimal("500.00"),
                withdrawable_balance=Decimal("500.00")
            )
            db.add(wallet)
            db.commit()
        else:
            wallet.balance = Decimal("500.00")
            wallet.withdrawable_balance = Decimal("500.00")
            db.commit()
        
        print("1. Set up test user with 500 GHS withdrawable balance.")
        
        # We need an access token to authenticate the API call
        from app.core.security import create_access_token
        from datetime import timedelta
        access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=15))
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # 2. Trigger the withdrawal from the 'frontend'
        print("2. Frontend sends withdrawal request (100 GHS via Paystack)...")
        payload = {
            "amount": 100.00,
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
            print(f"FAILED: API returned {response.status_code}")
            print(response.json())
            return
            
        data = response.json()
        print(f"API Response Status: {data.get('status')}")
        
        # Check DB to see what happened to the withdrawal
        req = db.query(WithdrawalRequest).filter(WithdrawalRequest.user_rid == user.rid).first()
        
        print("\n--- RESULTS ---")
        print(f"Withdrawal Status: {req.status} (Expected: APPROVED)")
        print(f"Admin Notes: {req.admin_notes}")
        
        # Check if wallet was correctly deducted (100 amount + 2 fee = 102 deducted)
        updated_wallet = db.query(Wallet).filter(Wallet.user_rid == user.rid).first()
        print(f"Remaining Withdrawable Balance: {updated_wallet.withdrawable_balance} (Expected: 398.00)")
        
        if req.status == "APPROVED" and "Automated payout successful" in req.admin_notes:
            print("\n✅ TEST PASSED: The system successfully simulated an automated payout and instantly approved the transaction!")
        else:
            print("\n❌ TEST FAILED: The automated flow did not approve the transaction.")
            
    except Exception as e:
        print(f"Error during test: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_automated_payouts()
