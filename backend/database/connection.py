import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database.models import Base

logger = logging.getLogger("uvicorn")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgrespassword@localhost:5432/datamind"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    logger.info("[Database] Initializing connection and tables...")
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            logger.info("[Database] pgvector extension verified/created.")
            
        Base.metadata.create_all(bind=engine)
        logger.info("[Database] Tables initialized successfully.")
    except Exception as e:
        logger.error(f"[Database] Error initializing database: {e}", exc_info=True)
        raise e

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
