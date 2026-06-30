import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text
from app.core.config import settings, sanitize_secrets

if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

from app.core.database import Base, engine
from app.api.v1 import auth, wallet, codes, referral, admin_auth, admin_settings, admin_ai, admin_codes, admin_analytics, marketplace, learning, ai, payments, education, users, engagement, tracks, instructors, shop
from app.services.code_engine import generate_admin_rid

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
from app.models.shop import Product, Order, Escrow, ShopSetting

import json
import logging

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        # Include custom extra fields if they exist
        for key, val in record.__dict__.items():
            if key not in ["args", "asctime", "created", "exc_info", "exc_text", "filename", "funcName", "levelname", "levelno", "lineno", "module", "msecs", "message", "msg", "name", "pathname", "process", "processName", "relativeCreated", "stack_info", "thread", "threadName", "taskName"]:
                log_record[key] = val
        return json.dumps(log_record)

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)
    
    # Configure uvicorn loggers to use the same structured handler
    for log_name in ["uvicorn.error", "uvicorn.access", "uvicorn", "fastapi"]:
        l = logging.getLogger(log_name)
        l.handlers = [handler]
        l.propagate = False

from starlette.types import Receive, Scope, Send

class SafeTrustedHostMiddleware(TrustedHostMiddleware):
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        # Bypass host header validation for the health check endpoint
        if scope.get("path") == "/health":
            await self.app(scope, receive, send)
            return

        # Otherwise, use the standard TrustedHostMiddleware behavior
        await super().__call__(scope, receive, send)

setup_logging()

def create_app() -> FastAPI:
    logger = logging.getLogger("uvicorn.error")

    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        debug=False
    )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """Catch-all: log full error server-side, return generic 500 to client."""
        logger.error(
            "Unhandled exception on %s %s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred."},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Return 422 without leaking internal field names or schema details."""
        logger.warning(
            "Validation error on %s %s: %s",
            request.method,
            request.url.path,
            exc.errors(),
        )
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid request data."},
        )

    app.add_middleware(
        SafeTrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS_LIST,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    if settings.ENFORCE_HTTPS:
        app.add_middleware(HTTPSRedirectMiddleware)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        # 1. Strict Content-Security-Policy (allows CDNs for Swagger assets)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )
        # 2. Strict-Transport-Security (HSTS)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        # 3. X-Content-Type-Options
        response.headers["X-Content-Type-Options"] = "nosniff"
        # 4. X-Frame-Options
        response.headers["X-Frame-Options"] = "DENY"
        # 5. Referrer-Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # 6. Permissions-Policy
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

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
            # Automatic schema migration for new columns
            try:
                if engine.name == "sqlite":
                    columns = db.execute(text("PRAGMA table_info(users)")).fetchall()
                    existing_cols = {col[1] for col in columns}
                else:
                    columns = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users'")).fetchall()
                    existing_cols = {col[0] for col in columns}
                
                cols_to_check = [
                    ("failed_login_attempts", "INTEGER DEFAULT 0"),
                    ("locked_until", "TIMESTAMP" if engine.name != "sqlite" else "DATETIME"),
                    ("preferred_notification_method", "VARCHAR DEFAULT 'auto'"),
                    ("last_onboarding_step", "INTEGER DEFAULT 0"),
                    ("is_beta_user", "BOOLEAN DEFAULT true"),
                    ("learning_goal", "VARCHAR DEFAULT 'General Exploration'"),
                    ("preferred_style", "VARCHAR DEFAULT 'Balanced'"),
                    ("onboarding_completed", "BOOLEAN DEFAULT false")
                ]
                for col_name, col_type in cols_to_check:
                    if col_name not in existing_cols:
                        print(f"Adding column {col_name} to users table")
                        db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        db.commit()
            except Exception as e:
                db.rollback()
                print(sanitize_secrets(f"Failed to migrate users table: {e}"))

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
                db.add(Wallet(user_rid=root_rid, balance=0, withdrawable_balance=0))
                db.add(Code(product_code="CT-ROOT-SEED", owner_rid=root_rid, price=20.00, tier_type="public"))
                
                # Seed 10 initial activation RID codes so the registration dropdown is not empty
                for _ in range(10):
                    db.add(Code(
                        generated_rid=generate_admin_rid(),
                        owner_rid=root_rid,
                        price=20.00,
                        tier_type="public",
                        platform_share=0.05,
                        seller_share=0.70,
                        family_share=0.25
                    ))
                
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
                    ("Science", "🔬"), ("Maths", "📐"), ("Technology", "🖥️"),
                ]
                for i, (name, icon) in enumerate(categories):
                    db.add(CourseCategory(name=name, icon=icon, position=i))
                
                # Seed default shop settings
                if not db.query(ShopSetting).first():
                    db.add(ShopSetting())
                
                db.commit()
                print("Seeded root + settings + tiers + 11 categories + shop settings")
            
            # Unconditionally seed critical default settings if they are missing
            for key, val, desc in [
                ("shop_platform_commission", "0.05", "Platform commission for e-commerce shop purchases (e.g. 0.05 = 5%)"),
                ("course_platform_commission", "0.05", "Platform commission for course purchases (e.g. 0.05 = 5%)")
            ]:
                exists = db.query(SystemSetting).filter(SystemSetting.key == key).first()
                if not exists:
                    db.add(SystemSetting(key=key, value=val, description=desc))
            db.commit()
            
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
            print(sanitize_secrets(f"Startup logic failed: {e}"))
        finally:
            db.close()
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        import asyncio
        # Run startup_logic in a thread so it doesn't block the event loop.
        # This allows the /health endpoint to respond immediately while
        # seeding and migrations run in the background.
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, startup_logic)
        yield

    app.router.lifespan_context = lifespan

    # Core Module Inclusion
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
    app.include_router(wallet.router, prefix=f"{settings.API_V1_STR}/wallet", tags=["Wallet"])
    app.include_router(codes.router, prefix=f"{settings.API_V1_STR}/codes", tags=["Codes Economy"])
    app.include_router(referral.router, prefix=f"{settings.API_V1_STR}/network", tags=["Network"])
    app.include_router(admin_auth.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(admin_settings.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(admin_ai.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(admin_codes.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(admin_analytics.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Control Center"])
    app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/marketplace", tags=["Learning Marketplace"])
    app.include_router(marketplace.router, prefix=f"{settings.API_V1_STR}/courses", tags=["Course Discovery"])
    app.include_router(learning.router, prefix=f"{settings.API_V1_STR}/learn", tags=["Pay-As-You-Learn"])
    app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["AI Tutor"])
    app.include_router(payments.router, prefix=f"{settings.API_V1_STR}/payments", tags=["Payment Simulator"])
    app.include_router(education.router, prefix=f"{settings.API_V1_STR}/education", tags=["Education Management"])
    app.include_router(engagement.router, prefix=f"{settings.API_V1_STR}/engagement", tags=["Engagement & Quizzes"])
    app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["User Profile & Onboarding"])
    app.include_router(tracks.router, prefix=f"{settings.API_V1_STR}/tracks", tags=["Learning Tracks"])
    app.include_router(instructors.router, prefix=f"{settings.API_V1_STR}/instructors", tags=["Instructors"])
    app.include_router(shop.router, prefix=f"{settings.API_V1_STR}/shop", tags=["Shopping Mall"])

    @app.get("/health")
    def health_check():
        """Lightweight health check — always returns 200 immediately.
        Railway uses this to decide if the container is alive.
        DB/Redis checks are intentionally excluded to prevent lock-induced hangs."""
        return {"status": "ok", "version": "2.0.0"}

    @app.get("/health/detailed")
    def health_check_detailed():
        """Full health check with DB and Redis connectivity. Use for monitoring only."""
        db_status = "connected"
        redis_status = "unknown"
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
        except Exception as e:
            print(sanitize_secrets(f"Health DB error: {e}"))
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
            "redis": redis_status,
            "paystack_configured": bool(settings.PAYSTACK_SECRET_KEY)
        }

    return app

app = create_app()
