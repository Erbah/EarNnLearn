from sqlalchemy.orm import Session
from app.models import NetworkTree

class NetworkEngine:
    @staticmethod
    def create_node(db: Session, user_id: int, parent_id: int | None = None) -> NetworkTree:
        """
        Creates a new node in the materialized path network tree.
        """
        if not parent_id:
            # Root node
            path = str(user_id)
            depth = 0
        else:
            parent_node = db.query(NetworkTree).filter(NetworkTree.user_id == parent_id).first()
            if not parent_node:
                if parent_id == 1:
                    parent_node = NetworkTree(user_id=1, parent_id=None, path="1", depth=0)
                    db.add(parent_node)
                    db.flush()
                else:
                    raise ValueError("Parent node not found in network tree.")
            
            path = f"{parent_node.path}.{user_id}"
            depth = parent_node.depth + 1

        new_node = NetworkTree(
            user_id=user_id,
            parent_id=parent_id,
            path=path,
            depth=depth
        )
        db.add(new_node)
        return new_node

network_engine = NetworkEngine()
