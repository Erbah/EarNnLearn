import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Setup mock environment BEFORE loading the app
import os
os.environ["TESTING"] = "1"
os.environ["DATABASE_BACKEND"] = "sqlite"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from main import app
from app.core.database import Base, get_db

# Create an in-memory SQLite database specifically for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables in the test database before running any tests."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """Provide a transactional scope around each test."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(autouse=True)
def mock_paystack_service(monkeypatch):
    """Mock the external Paystack payment gateway globally for all tests."""
    def mock_initialize(*args, **kwargs):
        return {
            "status": True,
            "data": {
                "authorization_url": "https://checkout.paystack.com/mock-url",
                "reference": "mock-ref-123",
                "access_code": "mock-access-code"
            }
        }
    
    # We must patch the method safely assuming it exists
    try:
        from app.services.paystack_service import paystack_service
        monkeypatch.setattr(paystack_service, "initialize_transaction", mock_initialize)
    except ImportError:
        pass
