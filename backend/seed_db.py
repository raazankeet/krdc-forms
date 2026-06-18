"""Idempotent seed script for local SQLite and production Postgres."""

import logging
import os
import sys

from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

from app.core.security import get_password_hash
from app.db.base import SessionLocal
from app.models.form import Form, FormAssignment, RequestNumbering
from app.models.user import Permission, Role, RolePermission, User, UserRole
from app.services.form_assignments import APPROVER_ROLE, REVIEWER_ROLE, SUBMITTER_ROLE


def get_or_create_permission(
    db: Session,
    *,
    code: str,
    description: str,
    resource: str,
    action: str,
) -> Permission:
    permission = db.query(Permission).filter(Permission.code == code).first()
    if permission:
        permission.description = description
        permission.resource = resource
        permission.action = action
        return permission

    permission = Permission(
        code=code,
        description=description,
        resource=resource,
        action=action,
    )
    db.add(permission)
    db.flush()
    return permission


def get_or_create_role(db: Session, *, name: str, description: str) -> Role:
    role = db.query(Role).filter(Role.name == name).first()
    if role:
        role.description = description
        return role

    role = Role(name=name, description=description)
    db.add(role)
    db.flush()
    return role


def ensure_role_permissions(db: Session, role: Role, permission_codes: list[str], permissions: dict[str, Permission]) -> None:
    existing_permission_ids = {row.permission_id for row in role.role_permissions}
    for code in permission_codes:
        permission = permissions[code]
        if permission.id in existing_permission_ids:
            continue
        db.add(RolePermission(role_id=role.id, permission_id=permission.id))


def get_or_create_user(
    db: Session,
    *,
    username: str,
    email: str,
    full_name: str,
    password: str,
    role: Role,
) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.email = email
        user.full_name = full_name
        user.is_active = True
    else:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            password_hash=get_password_hash(password),
            is_active=True,
        )
        db.add(user)
        db.flush()

    if not any(user_role.role_id == role.id for user_role in user.user_roles):
        db.add(UserRole(user_id=user.id, role_id=role.id))

    return user


def get_or_create_form(
    db: Session,
    *,
    form_code: str,
    name: str,
    description: str,
    print_scale: float,
) -> Form:
    form = db.query(Form).filter(Form.form_code == form_code).first()
    if form:
        form.name = name
        form.description = description
        form.is_active = True
        form.requires_approval = True
        form.approval_levels = 1
        form.print_scale = print_scale
        return form

    form = Form(
        form_code=form_code,
        name=name,
        description=description,
        is_active=True,
        requires_approval=True,
        approval_levels=1,
        print_scale=print_scale,
    )
    db.add(form)
    db.flush()
    return form


def ensure_request_numbering(db: Session, *, form: Form, prefix: str) -> None:
    numbering = db.query(RequestNumbering).filter(RequestNumbering.form_id == form.id).first()
    if numbering:
        numbering.prefix = prefix
        numbering.year_reset = True
        return

    db.add(
        RequestNumbering(
            form_id=form.id,
            prefix=prefix,
            year_reset=True,
            current_sequence=0,
            current_year=0,
        )
    )


def ensure_form_assignment(db: Session, *, form_id: int, user_id: int, role: str) -> None:
    existing = (
        db.query(FormAssignment)
        .filter(
            FormAssignment.form_id == form_id,
            FormAssignment.user_id == user_id,
            FormAssignment.role == role,
        )
        .first()
    )
    if existing:
        return

    db.add(FormAssignment(form_id=form_id, user_id=user_id, role=role))


def main() -> None:
    permissions_cfg: list[tuple[str, str, str, str]] = [
        ("user.manage", "Manage users", "user", "manage"),
        ("user.view", "View users", "user", "view"),
        ("user.create", "Create users", "user", "create"),
        ("user.edit", "Edit users", "user", "edit"),
        ("user.delete", "Delete/disable users", "user", "delete"),
        ("role.manage", "Manage roles", "role", "manage"),
        ("role.view", "View roles", "role", "view"),
        ("role.create", "Create roles", "role", "create"),
        ("role.edit", "Edit roles", "role", "edit"),
        ("form.manage", "Manage forms", "form", "manage"),
        ("form.view", "View forms", "form", "view"),
        ("form.create", "Create forms", "form", "create"),
        ("form.view_assigned", "View assigned forms", "form", "view_assigned"),
        ("submission.create", "Create submissions", "submission", "create"),
        ("submission.view_own", "View own submissions", "submission", "view_own"),
        ("submission.view", "View all submissions", "submission", "view"),
        ("submission.edit_draft", "Edit draft submissions", "submission", "edit_draft"),
        ("submission.submit", "Submit submissions", "submission", "submit"),
        ("submission.approve", "Approve submissions", "submission", "approve"),
        ("submission.reject", "Reject submissions", "submission", "reject"),
        ("submission.request_changes", "Request changes", "submission", "request_changes"),
        ("submission.resubmit", "Resubmit submissions", "submission", "resubmit"),
        ("review.view", "View review queue", "review", "view"),
        ("review.manage", "Manage reviews", "review", "manage"),
        ("audit.view", "View audit logs", "audit", "view"),
        ("report.view_admin", "View admin reports", "report", "view_admin"),
        ("report.view_reviewer", "View reviewer reports", "report", "view_reviewer"),
        ("report.view_user", "View user reports", "report", "view_user"),
        ("print.view", "Print submissions", "print", "view"),
    ]

    role_cfg: dict[str, list[str]] = {
        "Administrator": [code for code, *_ in permissions_cfg],
        "Approver": [
            "submission.view",
            "submission.approve",
            "submission.reject",
            "submission.request_changes",
            "review.view",
            "review.manage",
            "report.view_reviewer",
            "print.view",
            "form.view",
            "form.view_assigned",
        ],
        "Reviewer": [
            "submission.view",
            "submission.approve",
            "submission.request_changes",
            "review.view",
            "review.manage",
            "report.view_reviewer",
            "form.view",
            "form.view_assigned",
        ],
        "Research User": [
            "submission.create",
            "submission.view_own",
            "submission.edit_draft",
            "submission.submit",
            "submission.resubmit",
            "form.view_assigned",
            "report.view_user",
            "print.view",
        ],
    }

    users_cfg: list[tuple[str, str, str, str]] = [
        ("admin", "admin@glp-forms.local", "System Administrator", "Administrator"),
        ("approver1", "approver1@glp-forms.local", "Sarah Approver", "Approver"),
        ("reviewer1", "reviewer1@glp-forms.local", "James Reviewer", "Reviewer"),
        ("researcher1", "researcher1@glp-forms.local", "Dr. Alice Researcher", "Research User"),
        ("researcher2", "researcher2@glp-forms.local", "Dr. Bob Scientist", "Research User"),
    ]

    with SessionLocal() as db:
        print("Seeding database...")

        print("[1/5] Ensuring permissions...")
        permissions: dict[str, Permission] = {}
        for code, description, resource, action in permissions_cfg:
            permissions[code] = get_or_create_permission(
                db,
                code=code,
                description=description,
                resource=resource,
                action=action,
            )
        db.commit()
        print(f"    Permissions ready: {len(permissions)}")

        print("[2/5] Ensuring roles...")
        roles: dict[str, Role] = {}
        for role_name, permission_codes in role_cfg.items():
            roles[role_name] = get_or_create_role(
                db,
                name=role_name,
                description=f"{role_name} role",
            )
            db.flush()
            ensure_role_permissions(db, roles[role_name], permission_codes, permissions)
        db.commit()
        print(f"    Roles ready: {len(roles)}")

        print("[3/5] Ensuring users...")
        users: dict[str, User] = {}
        for username, email, full_name, role_name in users_cfg:
            users[username] = get_or_create_user(
                db,
                username=username,
                email=email,
                full_name=full_name,
                password="password123",
                role=roles[role_name],
            )
            print(f"    User ready: {username}")
        db.commit()

        print("[4/5] Ensuring forms...")
        mpai_form = get_or_create_form(
            db,
            form_code="MPAI",
            name="MPAI",
            description="Method precision calculation sheet with laboratory worksheet layout",
            print_scale=0.94,
        )
        ensure_request_numbering(db, form=mpai_form, prefix="REQ-MPAI")
        db.commit()
        print("    Form ready: MPAI")

        print("[5/5] Ensuring workflow assignments...")
        for username in ("researcher1", "researcher2"):
            ensure_form_assignment(db, form_id=mpai_form.id, user_id=users[username].id, role=SUBMITTER_ROLE)
        ensure_form_assignment(db, form_id=mpai_form.id, user_id=users["reviewer1"].id, role=REVIEWER_ROLE)
        ensure_form_assignment(db, form_id=mpai_form.id, user_id=users["approver1"].id, role=APPROVER_ROLE)
        db.commit()
        print("    Workflow access ready for submitter, reviewer, and approver roles")

    print("\nSeed complete.")
    print("\nDefault credentials (password: password123):")
    print("  admin / password123 (Administrator)")
    print("  approver1 / password123 (Approver)")
    print("  reviewer1 / password123 (Reviewer)")
    print("  researcher1 / password123 (Research User)")
    print("  researcher2 / password123 (Research User)")


if __name__ == "__main__":
    main()
