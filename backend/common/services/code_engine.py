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
import secrets
import hmac
import hashlib
from sqlalchemy.orm import Session

import os
# In production, this should be in settings/env
CODE_SECRET_KEY = os.getenv("CODE_SECRET_KEY", "CEDI-TREES-SECRET-2026")

def generate_rid(parent_rid: str, db: Session = None) -> str:
    """
    Generate a child RID under the given parent using dot-path structure.
    """
    # Use a short alphanumeric suffix to avoid collisions at scale
    suffix = ''.join(random.choices(string.digits, k=2)) + random.choice(string.ascii_lowercase)
    return f"{parent_rid}.{suffix}"


def get_parent_rid(rid: str) -> str | None:
    """
    Extract the parent RID from a dot-path RID.
    """
    parts = rid.split(".")
    if len(parts) <= 1:
        return None
    return ".".join(parts[:-1])


def get_depth(rid: str) -> int:
    """Get the depth of a RID in the tree."""
    return len(rid.split(".")) - 1


def generate_product_code() -> str:
    """
    Generates a secure, structured, and verifiable product code.
    Format: PC-XXXX-XXXX-KKKK (KKKK is checksum)
    CRITICAL: This format is immutable and MUST NOT be changed without explicit user authorization.
    """
    # 1. Generate 8 characters of cryptographically secure randomness
    chars = string.ascii_uppercase + string.digits
    p1 = ''.join(secrets.choice(chars) for _ in range(4))
    p2 = ''.join(secrets.choice(chars) for _ in range(4))
    
    # 2. Generate Checksum based on p1+p2 + secret
    data = f"{p1}{p2}".encode()
    checksum = hmac.new(CODE_SECRET_KEY.encode(), data, hashlib.sha256).hexdigest()[:4].upper()
    
    return f"PC-{p1}-{p2}-{checksum}"


def verify_product_code(code: str) -> bool:
    """
    Verifies a product code format and checksum offline.
    """
    if not code.startswith("PC-"):
        return False
        
    parts = code.split("-")
    if len(parts) != 4:
        return False
        
    p1, p2, checksum = parts[1], parts[2], parts[3]
    
    # Re-calculate checksum
    data = f"{p1}{p2}".encode()
    expected = hmac.new(CODE_SECRET_KEY.encode(), data, hashlib.sha256).hexdigest()[:4].upper()
    
    return hmac.compare_digest(checksum, expected)
