import secrets
import string
from sqlalchemy.orm import Session

ALPHABET = string.ascii_uppercase + string.digits

class CodeEngine:
    @staticmethod
    def secure_random(length=6):
        """Generates a cryptographically secure random string."""
        return ''.join(secrets.choice(ALPHABET) for _ in range(length))

    @staticmethod
    def generate_root_code(*, prefix: str = "A"):
        """Generates a Root/Master RID code."""
        # According to reference.md, Master code is just 'A'
        return prefix

    @staticmethod
    def get_next_child_index(db: Session, parent_identity: str) -> int:
        """Finds the next available child index for a given parent identity."""
        from app.models import Activation
        # In the refined logic, we store the full hierarchical path in Activation.user_rid
        # E.g. A, ACYHBN, ACYHBN.1
        all_children = db.query(Activation.user_rid).filter(
            Activation.user_rid.like(f"{parent_identity}.%")
        ).all()
        
        # If the parent is the root 'A', children are ACXXXX (not dotted)
        # Wait, the user's reference.md says:
        # A = master
        # ACYHBN = child of A (generated RID)
        # ACYHBN.1 = child of ACYHBN
        
        # Let's count immediate dotted children if parent is not root
        # Or if parent is a generated RID (like ACYHBN)
        
        parent_dots = parent_identity.count(".")
        immediate_children = [c for (c,) in all_children if c.count(".") == parent_dots + 1]
        
        return len(immediate_children) + 1

    @staticmethod
    def generate_user_identity_rid(db: Session, parent_identity: str, is_from_admin_rid: bool = False, admin_rid_code: str = None) -> str:
        """
        Generates a hierarchical identity RID for a new user.
        Case 1: Admin RID activation (ACXXXX) -> User Identity becomes ACXXXX
        Case 2: Referral (Product Code ACXXXX.1-...) -> User Identity becomes ACXXXX.1.N
        """
        if is_from_admin_rid and admin_rid_code:
            return admin_rid_code
            
        index = CodeEngine.get_next_child_index(db, parent_identity)
        return f"{parent_identity}.{index}"

    @staticmethod
    def generate_product_code(identity_rid: str) -> str:
        """
        Generates a secure product code based on the user's identity RID.
        Format: IdentityRID-CGCS-YTDS-QWER-SDFA (4 blocks of 4)
        """
        suffixes = [CodeEngine.secure_random(4) for _ in range(4)]
        return f"{identity_rid}-" + "-".join(suffixes)

    @staticmethod
    def extract_ancestors(identity_rid: str) -> list[str]:
        """
        Extracts all parent identity RIDs from a hierarchical identity RID.
        Example: ACYHBN.1.2 -> [ACYHBN.1, ACYHBN]
        Root 'A' is implied but usually not a payout target in the 'family' pool (Master has its own 5%).
        """
        parts = identity_rid.split(".")
        if len(parts) <= 1:
            # If it's ACXXXX, ancestors are just ['A'] or []
            # 'A' is the master, usually handled separately.
            return []
        
        ancestors = []
        for i in range(1, len(parts)):
            ancestor = ".".join(parts[:i])
            ancestors.append(ancestor)
            
        ancestors.reverse()
        return ancestors

    @staticmethod
    def generate_batch_rids(db: Session, count: int, tier_type: str = "public", price: float = 20.0, currency: str = "GHS", master_identity: str = "A", generated_by: int = 1):
        """
        Batch generates Admin RIDs (Direct Keys) with metadata.
        Format: A + C + 4 random chars (e.g. ACYHBN)
        """
        from app.models import GeneratedRid
        new_rids = []
        for _ in range(count):
            # A (master) + C (separator) + 4 random = 6 chars total
            code = f"{master_identity}C{CodeEngine.secure_random(4)}"
            while db.query(GeneratedRid).filter(GeneratedRid.rid_code == code).first():
                code = f"{master_identity}C{CodeEngine.secure_random(4)}"
            
            rid = GeneratedRid(
                rid_code=code,
                generated_by=generated_by,
                tier_type=tier_type,
                price=price,
                currency=currency,
                is_used=False
            )
            db.add(rid)
            new_rids.append(rid)
        db.commit()
        return new_rids

code_engine = CodeEngine()
