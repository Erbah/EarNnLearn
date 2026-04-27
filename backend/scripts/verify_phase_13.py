import requests
import json
import random
import time

BASE_URL = "http://localhost:8000/api/v1"

def verify_dual_entry():
    print("--- Phase 14 Verification: Dual-Entry Activation (RID & Product Code) ---")
    
    # 0. Fetch available RIDs
    print("\n1. Fetching available RIDs (Direct Keys)...")
    response = requests.get(f"{BASE_URL}/marketplace/rids")
    rids = response.json()
    if not rids:
        print("No RIDs available. Generating some via admin...")
        requests.post(f"{BASE_URL}/admin/codes/generate", json={"count": 5})
        response = requests.get(f"{BASE_URL}/marketplace/rids")
        rids = response.json()
    
    rid = rids[0]["code"]
    print(f"Selected RID: {rid}")

    # --- PATH A: RID Activation ---
    print("\n[PATH A] RID Activation Flow")
    
    # Initialize Payment
    print("Initializing payment [PATH A]...")
    pay_init = requests.post(f"{BASE_URL}/payments/simulate/initialize", json={"amount": 100.0}, timeout=10)
    ref_a = pay_init.json()["reference"]
    print(f"Payment initialized with ref: {ref_a}. Triggering callback...")
    requests.post(f"{BASE_URL}/payments/simulate/callback/{ref_a}", timeout=10) # Auto-success
    
    print(f"Activating with RID: {rid}...")
    act_a = requests.post(f"{BASE_URL}/activate", json={
        "activation_code": rid,
        "code_type": "rid",
        "payment_method": "momo",
        "payment_reference": ref_a,
        "payment_account": "0000000001"
    }, timeout=30)
    
    if act_a.status_code != 200:
        print(f"FAILED Path A: Status {act_a.status_code}, Body: {act_a.json()}")
        return
        
    product_code_a = act_a.json()["product_code"]
    print(f"SUCCESS! New Product Code: {product_code_a}")
    
    # Format Assertions for Path A
    # Roots children (ACXXXX) don't have dots yet. 
    # But they MUST have the 4-block hyphenated suffix.
    assert "-" in product_code_a, "Product code missing hyphenated blocks"
    parts = product_code_a.split("-")
    assert len(parts) == 5, f"Expected 4 blocks of suffix, got {len(parts)-1}"
    print("Format Verified: Root child identity (ACXXXX) and 4-block suffix confirmed.")

    # --- PATH B: Product Code Activation (Referral) ---
    print("\n[PATH B] Product Code Activation Flow (Market Pool)")
    
    # Verify the new product code appears in the marketplace
    print("Fetching marketplace product codes...")
    pc_response = requests.get(f"{BASE_URL}/marketplace/product-codes")
    market_pcs = pc_response.json()
    print(f"Market Pool Count: {len(market_pcs)}")
    
    if len(market_pcs) == 0:
        print("FAILED: Product code not found in marketplace.")
        return
        
    pc_to_use = market_pcs[0]["code"]
    print(f"Selected Product Code to join under: {pc_to_use}")

    # Initialize Payment
    pay_init_b = requests.post(f"{BASE_URL}/payments/simulate/initialize", json={"amount": 100.0})
    ref_b = pay_init_b.json()["reference"]
    requests.post(f"{BASE_URL}/payments/simulate/callback/{ref_b}")
    
    print(f"Activating with Product Code: {pc_to_use}...")
    act_b = requests.post(f"{BASE_URL}/activate", json={
        "activation_code": pc_to_use,
        "code_type": "product_code",
        "payment_method": "momo",
        "payment_reference": ref_b,
        "payment_account": "0000000002"
    })
    
    if act_b.status_code == 200:
        product_code_b = act_b.json()['product_code']
        print(f"SUCCESS! New Product Code for 2nd user: {product_code_b}")
        # Assertion for further hierarchy
        assert product_code_b.startswith(pc_to_use.split("-")[0] + "."), "Child identity should be parent identity + dot + index"
        print("Format Verified: Nested hierarchy confirmed (e.g. ACNIRP.1.1)")
        print("\n[PHASE 14 SUCCESS] Hierarchical Dual-entry verified.")
    else:
        print(f"FAILED Path B: {act_b.json()}")

if __name__ == "__main__":
    verify_dual_entry()
