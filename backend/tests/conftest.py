import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator, Dict

from app.db.base import Base
from app.main import app
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User, Role, Permission, UserRole, RolePermission


@pytest.fixture(scope="session")
def engine():
    """Create test database engine."""
    return create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})


@pytest.fixture(scope="session")
def tables(engine):
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(engine, tables) -> Generator[Session, None, None]:
    """Create a new database session for each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create test client with overridden DB dependency."""
    from app.core.deps import get_db
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seed_permissions(db_session: Session) -> Dict[str, Permission]:
    """Seed base permissions."""
    perms = {}
    codes = [
        ("user.view", "View users", "user", "view"),
        ("user.create", "Create users", "user", "create"),
        ("user.update", "Update users", "user", "update"),
        ("user.delete", "Delete users", "user", "delete"),
        ("user.manage", "Manage users", "user", "manage"),
        ("role.view", "View roles", "role", "view"),
        ("role.create", "Create roles", "role", "create"),
        ("role.manage", "Manage roles", "role", "manage"),
        ("form.view", "View forms", "form", "view"),
        ("form.create", "Create forms", "form", "create"),
        ("form.manage", "Manage forms", "form", "manage"),
        ("submission.create", "Create submissions", "submission", "create"),
        ("submission.view_own", "View own submissions", "submission", "view_own"),
        ("submission.view_all", "View all submissions", "submission", "view_all"),
        ("submission.edit_draft", "Edit draft", "submission", "edit_draft"),
        ("submission.submit", "Submit", "submission", "submit"),
        ("submission.approve", "Approve", "submission", "approve"),
        ("submission.reject", "Reject", "submission", "reject"),
        ("submission.request_changes", "Request changes", "submission", "request_changes"),
        ("submission.resubmit", "Resubmit", "submission", "resubmit"),
        ("audit.view", "View audit", "audit", "view"),
    ]
    for code, desc, resource, action in codes:
        perm = Permission(code=code, description=desc, resource=resource, action=action)
        db_session.add(perm)
        perms[code] = perm
    db_session.commit()
    return perms


@pytest.fixture(scope="function")
def seed_roles(db_session: Session, seed_permissions: Dict[str, Permission]) -> Dict[str, Role]:
    """Seed roles with permissions."""
    roles = {}

    admin = Role(name="Administrator", description="Admin role")
    admin.permissions = list(seed_permissions.values())
    db_session.add(admin)

    approver = Role(name="Approver", description="Approver role")
    approver.permissions = [
        seed_permissions["submission.approve"],
        seed_permissions["submission.reject"],
        seed_permissions["submission.request_changes"],
        seed_permissions["submission.view_all"],
    ]
    db_session.add(approver)

    researcher = Role(name="Research User", description="Researcher role")
    researcher.permissions = [
        seed_permissions["submission.create"],
        seed_permissions["submission.view_own"],
        seed_permissions["submission.edit_draft"],
        seed_permissions["submission.submit"],
        seed_permissions["submission.resubmit"],
    ]
    db_session.add(researcher)

    db_session.commit()
    roles["Administrator"] = admin
    roles["Approver"] = approver
    roles["Research User"] = researcher
    return roles


@pytest.fixture(scope="function")
def seed_user(db_session: Session, seed_roles: Dict[str, Role]) -> User:
    """Create a test researcher user."""
    from app.core.security import get_password_hash
    user = User(
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        password_hash=get_password_hash("password123"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    user_role = UserRole(user_id=user.id, role_id=seed_roles["Research User"].id)
    db_session.add(user_role)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def seed_admin(db_session: Session, seed_roles: Dict[str, Role]) -> User:
    """Create a test admin user."""
    from app.core.security import get_password_hash
    user = User(
        username="testadmin",
        email="admin@example.com",
        full_name="Test Admin",
        password_hash=get_password_hash("password123"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    user_role = UserRole(user_id=user.id, role_id=seed_roles["Administrator"].id)
    db_session.add(user_role)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def auth_headers(seed_user: User) -> Dict[str, str]:
    """Get auth headers for the test researcher."""
    token = create_access_token(
        subject=seed_user.id,
        username=seed_user.username,
        roles=["Research User"],
        permissions=["submission.create", "submission.view_own", "submission.edit_draft", "submission.submit", "submission.resubmit"],
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def admin_headers(seed_admin: User) -> Dict[str, str]:
    """Get auth headers for the test admin."""
    token = create_access_token(
        subject=seed_admin.id,
        username=seed_admin.username,
        roles=["Administrator"],
        permissions=[
            "user.view", "user.create", "user.update", "user.delete", "user.manage",
            "role.view", "role.create", "role.manage",
            "form.view", "form.create", "form.manage",
            "submission.create", "submission.view_all", "submission.approve",
            "submission.reject", "submission.request_changes",
            "audit.view",
        ],
    )
    return {"Authorization": f"Bearer {token}"}
