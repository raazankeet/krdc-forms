from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings
from urllib.parse import urlparse


def describe_database_target(database_url: str) -> str:
    if database_url.startswith("sqlite"):
        return f"sqlite ({database_url})"

    parsed = urlparse(database_url)
    scheme = parsed.scheme or "unknown"
    host = parsed.hostname or "unknown-host"
    port = parsed.port or "default"
    database = parsed.path.lstrip("/") or "default-db"
    username = parsed.username or "unknown-user"
    return f"{scheme}://{username}:***@{host}:{port}/{database}"

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_schema_compatibility():
    """Apply lightweight additive schema updates for development databases."""
    inspector = inspect(engine)

    if "forms" in inspector.get_table_names():
        form_columns = {column["name"] for column in inspector.get_columns("forms")}
        if "print_scale" not in form_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE forms ADD COLUMN print_scale FLOAT NOT NULL DEFAULT 0.94")
                )


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
