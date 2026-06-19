from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.exceptions import AppException
from app.db.base import (
    Base,
    engine,
    SessionLocal,
    ensure_schema_compatibility,
    describe_database_target,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print(f"[startup] DEBUG={settings.DEBUG}")
    print(f"[startup] DATABASE_TARGET={describe_database_target(settings.DATABASE_URL)}")

    # Startup: auto-run Alembic migrations on every deploy
    try:
        import alembic.config
        import alembic.command
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent
        alembic_cfg = alembic.config.Config(str(backend_dir / "alembic.ini"))
        alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
        alembic.command.upgrade(alembic_cfg, "head")
        print("[startup] Alembic migrations applied")
    except Exception as e:
        print(f"[startup] Alembic migration failed, falling back to create_all: {e}")
        Base.metadata.create_all(bind=engine)

    ensure_schema_compatibility()

    # Auto-seed database if empty (first deploy)
    try:
        db = SessionLocal()
        from app.models import User
        user_count = db.query(User).count()
        print(f"[startup] user_count_before_seed={user_count}")
        if user_count == 0:
            print("[startup] Empty database detected; running auto-seed...")
            print("Empty database detected — running auto-seed...")
            from app.db.seed import seed_permissions, seed_roles, seed_users, seed_forms, seed_assignments
            perms = seed_permissions(db)
            roles = seed_roles(db, perms)
            seed_users(db, roles)
            forms = seed_forms(db)
            seed_assignments(db, forms)
            final_user_count = db.query(User).count()
            print(f"[startup] auto-seed complete; user_count_after_seed={final_user_count}")
        db.close()
    except Exception as e:
        print(f"[startup] auto-seed skipped or failed: {e}")

    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS — explicit headers required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
)


def _cors_headers(request: Request) -> dict:
    """Derive CORS headers from the incoming Origin so error responses are not blocked."""
    origin = request.headers.get("origin")
    if origin and origin in settings.CORS_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


# Global exception handler
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.__class__.__name__.replace("Exception", "").upper(),
                "message": exc.message,
                "detail": exc.detail,
            },
        },
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "detail": {},
            },
        },
        headers=_cors_headers(request),
    )


@app.get("/api/health")
async def health_check():
    return {"success": True, "data": {"status": "healthy", "version": settings.APP_VERSION}}


# Import and register API routers
from app.api.v1 import auth, users, roles, forms, submissions, workflow, reviews, audit, reports, print as print_api

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(roles.router, prefix="/api/v1/roles", tags=["Roles"])
app.include_router(forms.router, prefix="/api/v1/forms", tags=["Forms"])
app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["Submissions"])
app.include_router(workflow.router, prefix="/api/v1", tags=["Workflow"])
app.include_router(reviews.router, prefix="/api/v1/reviews", tags=["Reviews"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(print_api.router, prefix="/api/v1", tags=["Print"])
