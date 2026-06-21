import os
import sqlalchemy as sa
from sqlalchemy import text

def run_updates():
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    if not db_url:
        print("No DATABASE_URL found. Skipping raw schema updates.")
        return

    print("Running schema updates...")
    engine = sa.create_engine(db_url)
    
    # 1. Run static updates (wrapped in try/except)
    with engine.connect() as conn:
        try:
            # Add missing columns safely (PostgreSQL specific IF NOT EXISTS syntax)
            if engine.name != "sqlite":
                conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS creator_name VARCHAR;"))
                conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS institution VARCHAR;"))
                conn.execute(text("ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;"))
                
                # Ensure notifications table has all necessary columns
                conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_rid VARCHAR;"))
                conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'SYSTEM';"))
                conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;"))
            
            # Add missing indexes safely
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_video_progress_video_id ON video_progress (video_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_video_progress_user_video ON video_progress (user_rid, video_id);"))
            
            # Restore all resalable product codes to active (used = FALSE) since they have no usage limit
            conn.execute(text("UPDATE codes SET used = FALSE WHERE product_code IS NOT NULL;"))
            
            conn.commit()
            print("Successfully added columns, indexes, and restored product codes.")
        except Exception as e:
            print(f"Error adding columns or indexes: {e}")

    # 2. Ensure all tables exist and run dynamic column adder (wrapped in try/except)
    try:
        from app.core.database import Base
        # Import models to register them with Base
        import app.models.course
        import app.models.user
        import app.models.wallet
        import app.models.transaction
        import app.models.code
        import app.models.progress
        import app.models.ai
        import app.models.notification
        import app.models.admin
        import app.models.learning
        import app.models.marketplace
        import app.models.engagement
        
        Base.metadata.create_all(bind=engine)
        print("Successfully ensured all tables exist.")
        
        # Dynamic missing-column adder
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        with engine.connect() as conn:
            for table_name, table in Base.metadata.tables.items():
                if not inspector.has_table(table_name):
                    continue
                
                existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                for column in table.columns:
                    if column.name not in existing_cols:
                        # Column is missing from database, but defined in SQLAlchemy model
                        col_type = str(column.type.compile(dialect=engine.dialect))
                        default_clause = ""
                        if column.default is not None and not callable(column.default.arg):
                            val = column.default.arg
                            if isinstance(val, bool):
                                val_str = "TRUE" if val else "FALSE"
                            elif isinstance(val, (int, float)):
                                val_str = str(val)
                            else:
                                val_str = f"'{val}'"
                            default_clause = f" DEFAULT {val_str}"
                        
                        # Safely add column (we already verified it doesn't exist in existing_cols)
                        alter_query = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}{default_clause}"
                        print(f"[DYNAMIC_MIGRATION] Running: {alter_query}")
                        try:
                            conn.execute(text(alter_query))
                            conn.commit()
                            print(f"[DYNAMIC_MIGRATION] Successfully added column {column.name} to table {table_name}")
                        except Exception as alter_err:
                            # Connection might need rollback
                            try:
                                conn.rollback()
                            except Exception:
                                pass
                            print(f"[DYNAMIC_MIGRATION] Failed to add column {column.name} to {table_name}: {alter_err}")
    except Exception as e:
        print(f"Error checking/migrating dynamic columns: {e}")
        
    # 3. Run recovery actions (wrapped in try/except)
    try:
        from app.models.user import User
        from app.models.code import Code
        from app.models.transaction import Transaction
        from app.services.activation_service import run_activation_engine
        from app.core.database import SessionLocal
        
        db_session = SessionLocal()
        try:
            amanda = db_session.query(User).filter(
                User.name.ilike("%Amanda%"),
                User.status == "pending"
            ).first()
            if amanda:
                print(f"Found pending user Amanda: {amanda.name} (ID: {amanda.id})")
                tx = db_session.query(Transaction).filter(
                    Transaction.buyer_rid == f"PENDING_ACT_{amanda.id}"
                ).first()
                if tx:
                    print(f"Found pending transaction for Amanda: {tx.id}")
                    code = db_session.query(Code).filter(Code.id == tx.code_id).first()
                    if code:
                        print(f"Found code for Amanda's transaction: {code.id}")
                        code.used = False
                        db_session.commit()
                        run_activation_engine(db_session, amanda, code, tx)
                        print("Successfully auto-activated Amanda Erbah during migration!")
        except Exception as e:
            db_session.rollback()
            print(f"Error during auto-activating Amanda: {e}")
        finally:
            db_session.close()
    except Exception as e:
        print(f"Failed to run auto-activation recovery: {e}")

if __name__ == "__main__":
    run_updates()
