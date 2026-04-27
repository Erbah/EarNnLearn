from common.database.db_session import SessionLocal
from common.models.learning_tree import LearningNode, LearningPrerequisite
import uuid

def seed_tree():
    db = SessionLocal()
    try:
        # Clear existing
        db.query(LearningPrerequisite).delete()
        db.query(LearningNode).delete()
        
        # 1. Root Node
        root = LearningNode(
            title="Viral Distribution 101",
            description="The basics of P2P sales networks.",
            node_type="COURSE",
            x_coord=100,
            y_coord=100,
            icon="Zap"
        )
        db.add(root)
        db.flush()
        
        # 2. Branch A: Growth
        growth = LearningNode(
            title="Network Growth",
            description="How to scale your distributor base.",
            node_type="COURSE",
            x_coord=0,
            y_coord=250,
            icon="TrendingUp"
        )
        db.add(growth)
        db.flush()
        
        # 3. Branch B: Economy
        economy = LearningNode(
            title="Tokenomics & Yield",
            description="Understanding the yield curves.",
            node_type="COURSE",
            x_coord=200,
            y_coord=250,
            icon="Coins"
        )
        db.add(economy)
        db.flush()
        
        # 4. Master Node
        master = LearningNode(
            title="Platform Architect",
            description="Master of the EarNnLearn ecosystem.",
            node_type="SPECIAL",
            x_coord=100,
            y_coord=400,
            icon="Crown"
        )
        db.add(master)
        db.flush()
        
        # Prerequisites
        db.add(LearningPrerequisite(node_id=growth.id, required_node_id=root.id))
        db.add(LearningPrerequisite(node_id=economy.id, required_node_id=root.id))
        db.add(LearningPrerequisite(node_id=master.id, required_node_id=growth.id))
        db.add(LearningPrerequisite(node_id=master.id, required_node_id=economy.id))
        
        db.commit()
        print("Learning Forest Seeded Successfully!")
        
    except Exception as e:
        print(f"Error seeding tree: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_tree()
