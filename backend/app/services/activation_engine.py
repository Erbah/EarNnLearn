from app.services.payment_engine import payment_engine
from app.services.code_engine import code_engine
from app.services.network_engine import network_engine
import logging

logger = logging.getLogger(__name__)

class ActivationEngine:
    @staticmethod
    def activate_code(db, user_id: int, activation_code: str, code_type: str, payment_method: str, payment_reference: str, payment_account: str, amount: float):
        """
        Executes the entire activation flow automatically and safely:
        1. Verifies payment (mocked via payment engine)
        2. Identifies parent and source code (RID or Product Code)
        3. Generates hierarchical identity (e.g. ACYHBN or ACYHBN.1)
        4. Generates new Product Code (e.g. ACYHBN-XXXX-XXXX-XXXX-XXXX)
        5. Creates Activation record
        6. Places user in NetworkTree
        7. Queues Async Profit Distribution
        """
        from app.models import GeneratedRid, Activation, ProductCode, NetworkTree, Transaction
        
        try:
            # 1. Verify Payment
            txn_id = payment_engine.verify_payment(payment_reference)
            
            # Ensure a Transaction record exists
            db_txn = db.query(Transaction).filter(Transaction.payment_reference == payment_reference).first()
            if not db_txn:
                db_txn = Transaction(
                    user_id=user_id,
                    amount=amount,
                    payment_method=payment_method,
                    payment_reference=payment_reference,
                    status="success"
                )
                db.add(db_txn)
                db.flush()
            
            transaction_id = db_txn.id
            
            parent_id = None
            rid_id = None
            parent_identity = "A" # Default for master

            # 2. Identify Source and Parent Identity
            if code_type == "rid":
                rid = db.query(GeneratedRid)\
                    .filter(GeneratedRid.rid_code == activation_code)\
                    .first()

                if not rid:
                    raise ValueError("RID not found")
                if rid.is_used:
                    raise ValueError("RID already used")

                rid.is_used = True
                rid_id = rid.id
                parent_id = rid.generated_by
                
                # Fetch parent identity
                if parent_id != 1:
                    parent_activation = db.query(Activation).filter(Activation.user_id == parent_id).first()
                    parent_identity = parent_activation.user_rid if parent_activation else "A"
                
                # User Identity *is* the Admin RID (e.g., ACYHBN)
                identity_rid = code_engine.generate_user_identity_rid(
                    db, parent_identity, is_from_admin_rid=True, admin_rid_code=activation_code
                )
            
            elif code_type == "product_code":
                pc_source = db.query(ProductCode)\
                    .filter(ProductCode.product_code == activation_code)\
                    .first()
                
                if not pc_source:
                    raise ValueError("Product Code not found")
                
                parent_id = pc_source.activated_by
                # Identity RID is the part before the first dash
                parent_identity = activation_code.split("-")[0]
                
                # User Identity becomes ParentIdentity.index (e.g., ACYHBN.1)
                identity_rid = code_engine.generate_user_identity_rid(db, parent_identity)
            else:
                raise ValueError("Invalid code_type")

            # 3. Generate Product Code
            new_product_code_str = code_engine.generate_product_code(identity_rid)
            
            new_product = ProductCode(
                product_code=new_product_code_str,
                generated_by=parent_id,
                activated_by=user_id,
            )
            db.add(new_product)
            db.flush()

            # 4. Create Activation Record
            activation = Activation(
                user_id=user_id,
                rid_id=rid_id,
                product_code_id=new_product.id,
                transaction_id=transaction_id,
                user_rid=identity_rid
            )
            db.add(activation)
            db.flush()

            # 5. Network Engine (Place user in tree)
            existing_node = db.query(NetworkTree).filter(NetworkTree.user_id == user_id).first()
            if not existing_node:
                nt_node = network_engine.create_node(db, user_id, parent_id=parent_id)
            else:
                nt_node = existing_node

            # 6. Queue Async Profit Distribution
            ancestor_rids = code_engine.extract_ancestors(identity_rid)
            
            master_id = 1
            seller_id = parent_id
            
            db.commit()
            
            def run_async_profit():
                try:
                    from app.tasks.profit_tasks import distribute_profit
                    distribute_profit.apply_async(
                        args=[activation.id, seller_id, master_id, amount, ancestor_rids],
                        countdown=1
                    )
                except Exception as cel_e:
                    logger.warning(f"Failed to queue profit task: {cel_e}")

            import threading
            threading.Thread(target=run_async_profit, daemon=True).start()

            return new_product_code_str

        except Exception as e:
            db.rollback()
            raise e

activation_engine = ActivationEngine()
