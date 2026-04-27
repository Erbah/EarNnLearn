"""
CediTrees 2.0 — Code Engine (Dot-Path RID System)
====================================================
RID Format: ACNIRP.1.2.1.3.4
Children:   ACNIRP.1.2.1.3.4.1, ACNIRP.1.2.1.3.4.2, ...
Parent:     ACNIRP.1.2.1.3
Depth:      len(rid.split('.'))
"""
import random
import string
import hashlib
import hmac
from sqlalchemy.orm import Session
from app.core.config import settings


def generate_rid(parent_rid: str, db: Session = None) -> str:
    """
    Generate a child RID under the given parent using dot-path structure.
    
    Example:
        parent_rid = "ACNIRP.1.2"
        returns    = "ACNIRP.1.2.3"  (where 3 = next child number or random)
    """
    # Use a short alphanumeric suffix to avoid collisions at scale
    suffix = ''.join(random.choices(string.digits, k=2)) + random.choice(string.ascii_lowercase)
    return f"{parent_rid}.{suffix}"


def get_parent_rid(rid: str) -> str | None:
    """
    Extract the parent RID from a dot-path RID.
    
    Example:
        "ACNIRP.1.2.1.3" -> "ACNIRP.1.2.1"
        "ACNIRP" -> None (root node)
    """
    parts = rid.split(".")
    if len(parts) <= 1:
        return None
    return ".".join(parts[:-1])


def get_depth(rid: str) -> int:
    """Get the depth of a RID in the tree."""
    return len(rid.split(".")) - 1


def generate_admin_rid(master_identity: str = "A") -> str:
    """
    Generates an Admin RID (Direct Key).
    Format: A. + 4 random characters (e.g. A.YHBN)
    """
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{master_identity}.{suffix}"


def generate_product_code(identity_rid: str = None) -> str:
    """
    Generates a secure, resalable invitation product code.
    Format: CT-XXXX-XXXX-XXXX (where the last block is an HMAC checksum)
    """
    # 1. Generate core random blocks
    p1 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    p2 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    # 2. Add identity element if provided (CT-ID-P1-P2-CS) or just CT-P1-P2-CS
    core_data = f"{identity_rid}-{p1}-{p2}" if identity_rid else f"{p1}-{p2}"
    
    # 3. Generate secure checksum
    secret = settings.SECRET_KEY.encode()
    data_to_sign = core_data.encode()
    checksum = hmac.new(secret, data_to_sign, hashlib.sha256).hexdigest()[:4].upper()
    
    return f"CT-{core_data}-{checksum}"

def verify_product_code_checksum(code: str) -> bool:
    """
    Verifies the embedded HMAC checksum of a product code without needing a DB lookup.
    """
    parts = code.split("-")
    if len(parts) < 4 or parts[0] != "CT":
        return False
        
    checksum = parts[-1]
    # The core data is everything between 'CT-' and the checksum block
    # E.g., CT-P1-P2-CS -> P1-P2
    core_data = "-".join(parts[1:-1])
    
    secret = settings.SECRET_KEY.encode()
    expected_checksum = hmac.new(secret, core_data.encode(), hashlib.sha256).hexdigest()[:4].upper()
    
    return checksum == expected_checksum
