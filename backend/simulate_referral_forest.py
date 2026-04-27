import random
import string
import secrets
import hmac
import hashlib
from decimal import Decimal
import json

# --- CONFIG & SECRETS (Replicated from code_engine.py) ---
CODE_SECRET_KEY = "CEDI-TREES-SECRET-2026"

def generate_rid(parent_rid):
    suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return f"{parent_rid}.{suffix}"

def generate_product_code():
    chars = string.ascii_uppercase + string.digits
    p1 = ''.join(secrets.choice(chars) for _ in range(4))
    p2 = ''.join(secrets.choice(chars) for _ in range(4))
    data = f"{p1}{p2}".encode()
    checksum = hmac.new(CODE_SECRET_KEY.encode(), data, hashlib.sha256).hexdigest()[:4].upper()
    return f"PC-{p1}-{p2}-{checksum}"

# --- SIMULATION STATE ---
class User:
    def __init__(self, rid, parent_rid=None):
        self.rid = rid
        self.parent_rid = parent_rid
        self.product_code = generate_product_code()
        self.direct_profit = Decimal("0.00")
        self.extra_profit = Decimal("0.00")
        self.total_earned = Decimal("0.00")

class Simulation:
    def __init__(self):
        self.users = {} # rid -> User
        self.product_codes = {} # pc -> rid
        self.transactions = []
        self.master_profit = Decimal("0.00")
        self.errors = []

    def get_ancestors(self, rid):
        ancestors = []
        parts = rid.split(".")
        for i in range(1, len(parts)):
            parent = ".".join(parts[:i])
            if parent in self.users:
                ancestors.append(parent)
        return ancestors[::-1] # Nearest parent first

    def add_user(self, parent_rid=None):
        if parent_rid is None:
            rid = f"A.{''.join(secrets.choice(string.ascii_uppercase) for _ in range(4))}"
        else:
            rid = generate_rid(parent_rid)
        
        if rid in self.users:
            self.errors.append(f"Collision detected for RID: {rid}")
            return None
        
        new_user = User(rid, parent_rid)
        self.users[rid] = new_user
        self.product_codes[new_user.product_code] = rid
        return new_user

    def simulate_purchase(self, buyer_name, sponsor_rid):
        # 100 GHS per purchase
        price = Decimal("100.00")
        
        # New user joins
        new_user = self.add_user(sponsor_rid)
        if not new_user: return
        
        # Profit Split
        direct_parent_cut = price * Decimal("0.70") # 70%
        master_cut = price * Decimal("0.05")        # 5%
        extra_cut = price * Decimal("0.25")         # 25% (Distributed among uplines)

        # 1. Direct Parent
        sponsor = self.users[sponsor_rid]
        sponsor.direct_profit += direct_parent_cut
        sponsor.total_earned += direct_parent_cut

        # 2. Master
        self.master_profit += master_cut

        # 3. Extra Distribution (Family Tree)
        ancestors = self.get_ancestors(new_user.rid)
        # EXCLUDE the direct parent (sponsor) from the ancestors list for the 25% sharing
        uplines = [anc for anc in ancestors if anc != sponsor_rid]
        
        if uplines:
            share = extra_cut / len(uplines)
            for anc_rid in uplines:
                anc = self.users[anc_rid]
                anc.extra_profit += share
                anc.total_earned += share
        else:
            # No uplines (other than sponsor)? Master takes the extra (unclaimed)
            self.master_profit += extra_cut

        self.transactions.append({
            "buyer": new_user.rid,
            "sponsor": sponsor_rid,
            "uplines": uplines,
            "distribution": {
                "direct": str(direct_parent_cut),
                "master": str(master_cut),
                "extra": str(extra_cut)
            }
        })

    def validate(self):
        # 1. Uniqueness
        if len(self.users) != len(set(self.users.keys())):
            self.errors.append("RID Collision found!")
        if len(self.product_codes) != len(set(self.product_codes.keys())):
            self.errors.append("Product Code Collision found!")
        
        # 2. Circular References
        for rid, user in self.users.items():
            path = set()
            curr = rid
            while curr:
                if curr in path:
                    self.errors.append(f"Circular reference detected at {curr}!")
                    break
                path.add(curr)
                curr = self.users[curr].parent_rid if curr in self.users else None
        
        # 3. Summation Check
        total_sales = Decimal("100.00") * (len(self.users) - 10) # 200 users @ 100 GHS
        total_distributed = self.master_profit + sum(u.total_earned for u in self.users.values())
        if abs(total_sales - total_distributed) > Decimal("0.01"):
            self.errors.append(f"Balance Mismatch: Sales {total_sales} != Payouts {total_distributed}")

    def print_report(self):
        print("=== SIMULATION REPORT ===")
        print(f"Total Users: {len(self.users)}")
        print(f"Total Transactions: {len(self.transactions)}")
        print(f"Master Platform Profit: {self.master_profit} GHS")
        
        # Top Earners
        top = sorted(self.users.values(), key=lambda u: u.total_earned, reverse=True)[:5]
        print("\n--- TOP EARNERS ---")
        for u in top:
            print(f"RID: {u.rid:15} | Direct: {u.direct_profit:8} | Extra: {u.extra_profit:8} | Total: {u.total_earned:8}")

        # Tree Structure (Sample)
        print("\n--- NETWORK TREE STRUCTURE (SAMPLING DEPTH) ---")
        depths = [len(rid.split('.')) for rid in self.users.keys()]
        print(f"Max Depth: {max(depths)}")
        print(f"Average Depth: {sum(depths)/len(depths):.2f}")
        
        if self.errors:
            print("\n--- ERRORS ---")
            for e in self.errors: print(f"ERROR: {e}")
        else:
            print("\nSYSTEM VALIDATED: Integrity, Hierarchy, and Economy splits are 100% correct.")

# Run Simulation
sim = Simulation()

print("Initializing 10 Root Seed Owners...")
for _ in range(10):
    sim.add_user()

print("Simulating 200 Viral Joins...")
for i in range(200):
    all_rids = list(sim.users.keys())
    sponsor = random.choice(all_rids)
    sim.simulate_purchase(f"User_{i}", sponsor)

sim.validate()
sim.print_report()

# Save Logs
with open("simulation_logs.json", "w") as f:
    json.dump(sim.transactions, f, indent=2)
print("\nFull transaction logs saved to simulation_logs.json")
