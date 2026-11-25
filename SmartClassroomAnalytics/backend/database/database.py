from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

# ============================================================
# DATABASE CONFIGURATION & RESILIENT FALLBACK
# ============================================================

DEFAULT_PG = "postgresql+psycopg2://postgres:1234@localhost:5432/smart_classroom"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_PG)

def _init_engine():
    global DATABASE_URL
    if "sqlite" in DATABASE_URL:
        return create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
    try:
        eng = create_engine(DATABASE_URL, connect_args={"connect_timeout": 1}, echo=False)
        with eng.connect():
            pass
        return eng
    except Exception as e:
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "smartclassroom.db"))
        sqlite_url = f"sqlite:///{db_path}"
        logger.warning(f"Could not connect to PostgreSQL ({e}). Using SQLite fallback: {sqlite_url}")
        DATABASE_URL = sqlite_url
        return create_engine(sqlite_url, connect_args={"check_same_thread": False}, echo=False)

engine = _init_engine()

# ============================================================
# SESSION
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ============================================================
# BASE MODEL
# ============================================================

Base = declarative_base()

# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()