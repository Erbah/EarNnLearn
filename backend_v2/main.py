from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1 import auth, wallet, codes, referral, admin, marketplace, learning, ai, payments, education, users, engagement

# Import all models so Base.metadata knows about them
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.models.transaction import Transaction, ReferralIndex
from app.models.code import Code
from app.models.course import Course, Module, Video
from app.models.progress import CourseProgress
from app.models.ai import AIUsage, AILesson, LessonProgress, LessonChat
from app.models.admin import SystemSetting, Tier, AdminLog, Advertisement, Season
from app.models.learning import CoursePayment, VideoProgress
from app.models.marketplace import CourseCategory, CourseEnrollment, CourseReview, Certificate
from app.models.engagement import Quiz, QuizQuestion, QuizOption, QuizAttempt, Discussion, DiscussionReply

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        debug=True
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def startup_logic():
        from app.core.database import SessionLocal, engine
        from app.models.learning import CoursePayment, VideoProgress, SkillNode, skill_prerequisites
        from app.models.transaction import ReferralIndex
        import bcrypt
        
        # Ensure tables exist
        Base.metadata.create_all(bind=engine)
        print(f"CORS Allowed Origins: {settings.CORS_ORIGINS_LIST}")
        
        db = SessionLocal()
        try:
            existing = db.query(User).first()
            if not existing:
                root_rid = "ACNIRP"
                hashed = bcrypt.hashpw(settings.ROOT_USER_PASSWORD.encode(), bcrypt.gensalt()).decode()
                root_user = User(
                    rid=root_rid, name="Platform Root", email=settings.ROOT_USER_EMAIL,
                    phone="000-0000", password_hash=hashed, tier_type="admin", 
                    role="SUPER_ADMIN", status="active"
                )
                db.add(root_user)
                db.add(ReferralIndex(user_rid=root_rid, parent_rid=None, path=root_rid, depth=0))
                db.add(Wallet(user_rid=root_rid, balance=1000, withdrawable_balance=1000))
                db.add(Code(product_code="CT-ROOT-SEED", owner_rid=root_rid, price=20.00, tier_type="public"))
                
                # Seed default system settings
                defaults = [
                    ("seller_percentage", "0.70", "Seller profit share"),
                    ("master_percentage", "0.05", "Master platform share"),
                    ("family_percentage", "0.25", "Family network share"),
                    ("activation_price", "20.00", "Minimum activation price (GHS)"),
                    ("min_product_code_price", "20.00", "Minimum resale code price (GHS)"),
                    ("min_withdrawal", "50.00", "Minimum withdrawal amount (GHS)"),
                    ("withdrawal_fee", "2.00", "Withdrawal processing fee (GHS)"),
                    ("season_duration_days", "90", "Season length in days"),
                    ("default_currency", "GHS", "Platform default currency"),
                ]
                for key, val, desc in defaults:
                    db.add(SystemSetting(key=key, value=val, description=desc))
                
                # Seed default tiers
                db.add(Tier(name="creator", code_percentage=30, seller_share=0.70, family_share=0.25, master_share=0.05))
                db.add(Tier(name="ngo", code_percentage=20, seller_share=0.70, family_share=0.25, master_share=0.05))
                db.add(Tier(name="public", code_percentage=50, seller_share=0.70, family_share=0.25, master_share=0.05))
                
                # Seed course categories
                categories = [
                    ("Artificial Intelligence", "🤖"), ("Digital Marketing", "📱"),
                    ("Programming", "💻"), ("Entrepreneurship", "🚀"),
                    ("Finance", "💰"), ("Personal Development", "🧠"),
                    ("Design", "🎨"), ("Data Science", "📊"),
                ]
                for i, (name, icon) in enumerate(categories):
                    db.add(CourseCategory(name=name, icon=icon, position=i))
                
                db.commit()
                print("Seeded root + settings + tiers + 8 categories")
            
            # Seed Learning Forest (The Skill Tree) - Run independently
            if not db.query(SkillNode).first():
                node1 = SkillNode(
                    id="viral_101",
                    title="Viral Distribution 101",
                    description="Master the art of network growth and incentive structures.",
                    node_type="COURSE",
                    x_coord=100.0,
                    y_coord=100.0,
                    icon="Zap"
                )
                node2 = SkillNode(
                    id="adv_tactics",
                    title="Advanced Referral Tactics",
                    description="Deep dive into psychological triggers and conversion optimization.",
                    node_type="COURSE",
                    x_coord=300.0,
                    y_coord=250.0,
                    icon="Sparkles"
                )
                node3 = SkillNode(
                    id="scaling_network",
                    title="Network Scaling",
                    description="Learn to manage and automate thousands of deep-tier relationships.",
                    node_type="COURSE",
                    x_coord=500.0,
                    y_coord=400.0,
                    icon="TreePine"
                )
                
                db.add_all([node1, node2, node3])
                db.flush()
                
                # Set relationships
                node2.prerequisites.append(node1)
                node3.prerequisites.append(node2)
                
                db.commit()
                print("Seeded 3 Learning Forest nodes")
        except Exception as e:
            db.rollback()
            print(f"Startup logic failed: {e}")
        finally:
            db.close()

    @app.on_event("startup")
    def on_startup():
        startup_logic()

    # Core Module Inclusion
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
    app.include_router(wallet.router, prefix=f"{settings.API_V1_STR}/wallet", tags=["Wallet"])
    app.include_router(codes.router, prefix=f"{settings.API_V1_STR}/codes", tags=["Codes Economy"])
    app.include_router(referral.router, prefix=f"{settings.API_V1_STR}/network", tags=["Network"])
    app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["Learning Marketplace"])
    app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/courses", tags=["Course Discovery"])
    app.include_router(learning.router, prefix=f"{settings.API_V1_STR}/learn", tags=["Pay-As-You-Learn"])
    app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["AI Tutor"])
    app.include_router(payments.router, prefix=f"{settings.API_V1_STR}/payments", tags=["Payment Simulator"])
    app.include_router(education.router, prefix=f"{settings.API_V1_STR}/education", tags=["Education Management"])
    app.include_router(engagement.router, prefix=f"{settings.API_V1_STR}/engagement", tags=["Engagement & Quizzes"])
    app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["User Profile & Onboarding"])

    @app.get("/health")
    def health_check():
        """Enhanced health check with database connectivity verification."""
        db_status = "connected"
        redis_status = "unknown"
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
        except Exception as e:
            print(f"Health DB error: {e}")
            db_status = "disconnected"
        
        try:
            from app.core.redis import redis_client
            redis_client.ping()
            redis_status = "connected"
        except Exception:
            redis_status = "disconnected"
            
        return {
            "status": "ok",
            "version": "2.0.0",
            "database": db_status,
            "redis": redis_status
        }

    return app

app = create_app()
