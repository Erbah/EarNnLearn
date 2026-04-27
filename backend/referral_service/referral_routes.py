from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from common.database.db_session import get_db
from common.core.security import get_current_user
from common.models.user import User
from common.models.wallet import Wallet, WalletTransaction
from common.models.transaction import ReferralIndex
from pydantic import BaseModel
from decimal import Decimal

class NetworkNode(BaseModel):
    user_id: str
    depth: int
    
    class Config:
        from_attributes = True

class TreeNode(BaseModel):
    id: str  # Use User UUID
    name: str | None = None
    earnings: float = 0.0
    children_count: int = 0
    children: list["TreeNode"] = []

router = APIRouter()

@router.get("/tree", response_model=list[NetworkNode])
def get_user_network_tree(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.rid:
        return []
    my_node = db.query(ReferralIndex).filter(ReferralIndex.user_rid == current_user.rid).first()
    if not my_node:
        return []
    
    descendants = db.query(ReferralIndex).filter(
        ReferralIndex.path.like(f"{my_node.path}.%")
    ).all()
    
    # Map RIDs to UUIDs
    all_rids = [d.user_rid for d in descendants]
    users_db = db.query(User.rid, User.id).filter(User.rid.in_(all_rids)).all()
    rid_to_uuid = {u.rid: str(u.id) for u in users_db}
    
    result = []
    for d in descendants:
        result.append(NetworkNode(
            user_id=rid_to_uuid.get(d.user_rid, d.user_rid),
            depth=d.depth - my_node.depth
        ))
    return result


@router.get("/tree-view", response_model=TreeNode)
def get_visual_tree(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns a nested tree structure for React Flow visualization.
    Each node contains: RID, name, total earnings, and children count.
    Uses RID prefix matching — no recursive DB queries.
    """
    if not current_user.rid:
        return TreeNode(id="none", name="Not Activated")

    user_rid = current_user.rid

    # 1. Grab ALL descendants in one query (flat list)
    my_node = db.query(ReferralIndex).filter(ReferralIndex.user_rid == user_rid).first()
    if not my_node:
        return TreeNode(id=user_rid, name=current_user.name)

    all_nodes = db.query(ReferralIndex).filter(
        (ReferralIndex.user_rid == user_rid) |
        (ReferralIndex.path.like(f"{my_node.path}.%"))
    ).all()

    # 2. Batch-load user details
    all_rids = [n.user_rid for n in all_nodes]
    users_db = db.query(User).filter(User.rid.in_(all_rids)).all()
    
    rid_to_uuid = {u.rid: str(u.id) for u in users_db}
    users_map = {u.rid: u.name or "User" for u in users_db}

    earnings_map = {}
    wallet_rows = db.query(Wallet.user_rid, Wallet.balance).filter(Wallet.user_rid.in_(all_rids)).all()
    for w in wallet_rows:
        earnings_map[w.user_rid] = float(w.balance or 0)

    # 3. Build tree using UUIDs as IDs, but keep RID mapping for linking
    nodes_dict = {}
    for n in all_nodes:
        uuid_str = rid_to_uuid.get(n.user_rid, n.user_rid)
        nodes_dict[n.user_rid] = TreeNode(
            id=uuid_str,
            name=users_map.get(n.user_rid, "User"),
            earnings=earnings_map.get(n.user_rid, 0.0),
            children=[]
        )

    # Link children to parents
    root = None
    for n in all_nodes:
        node = nodes_dict[n.user_rid]
        if n.user_rid == user_rid:
            root = node
        elif n.parent_rid and n.parent_rid in nodes_dict:
            nodes_dict[n.parent_rid].children.append(node)

    # 4. Count children recursively
    def count_children(node: TreeNode) -> int:
        total = len(node.children)
        for child in node.children:
            total += count_children(child)
        node.children_count = total
        return total

    if root:
        count_children(root)
        return root

    return TreeNode(id=user_rid, name=current_user.name)

