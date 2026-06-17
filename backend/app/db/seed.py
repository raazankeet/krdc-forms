"""
Seed script for initial database setup.
Creates permissions, roles, users, forms, and request numbering.
Run with: python -m app.db.seed
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db.base import SessionLocal, Base, engine
from app.models import User, Role, Permission, UserRole, RolePermission
from app.models import Form, FormFieldDefinition, FormAssignment, RequestNumbering
from app.models import Submission, SubmissionVersion, SubmissionComment, WorkflowAction, AuditLog
from app.core.security import get_password_hash

# Ensure tables exist
Base.metadata.create_all(bind=engine)


def seed_permissions(db):
    """Create all granular permissions."""
    permissions_data = [
        # User management
        ("user.manage", "Manage users", "user", "manage"),
        ("user.view", "View users", "user", "view"),
        ("user.create", "Create users", "user", "create"),
        ("user.edit", "Edit users", "user", "edit"),
        ("user.delete", "Delete/disable users", "user", "delete"),
        # Role management
        ("role.manage", "Manage roles", "role", "manage"),
        ("role.view", "View roles", "role", "view"),
        ("role.create", "Create roles", "role", "create"),
        ("role.edit", "Edit roles", "role", "edit"),
        # Form management
        ("form.manage", "Manage forms", "form", "manage"),
        ("form.view", "View forms", "form", "view"),
        ("form.create", "Create forms", "form", "create"),
        ("form.view_assigned", "View assigned forms", "form", "view_assigned"),
        # Submission management
        ("submission.create", "Create submissions", "submission", "create"),
        ("submission.view_own", "View own submissions", "submission", "view_own"),
        ("submission.view", "View all submissions", "submission", "view"),
        ("submission.edit_draft", "Edit draft submissions", "submission", "edit_draft"),
        ("submission.submit", "Submit submissions", "submission", "submit"),
        ("submission.approve", "Approve submissions", "submission", "approve"),
        ("submission.reject", "Reject submissions", "submission", "reject"),
        ("submission.request_changes", "Request changes", "submission", "request_changes"),
        ("submission.resubmit", "Resubmit submissions", "submission", "resubmit"),
        # Review
        ("review.view", "View review queue", "review", "view"),
        ("review.manage", "Manage reviews", "review", "manage"),
        # Audit
        ("audit.view", "View audit logs", "audit", "view"),
        # Reports
        ("report.view_admin", "View admin reports", "report", "view_admin"),
        ("report.view_reviewer", "View reviewer reports", "report", "view_reviewer"),
        ("report.view_user", "View user reports", "report", "view_user"),
        # Print
        ("print.view", "Print submissions", "print", "view"),
    ]

    perm_objects = {}
    for code, desc, resource, action in permissions_data:
        existing = db.query(Permission).filter(Permission.code == code).first()
        if not existing:
            perm = Permission(code=code, description=desc, resource=resource, action=action)
            db.add(perm)
            db.flush()
            perm_objects[code] = perm
        else:
            perm_objects[code] = existing

    db.commit()
    print(f"  Created/verified {len(perm_objects)} permissions")
    return perm_objects


def seed_roles(db, perms):
    """Create default roles with permissions."""
    roles_config = {
        "Administrator": list(perms.keys()),  # All permissions
        "Approver": [
            "submission.view", "submission.approve", "submission.reject",
            "submission.request_changes", "review.view", "review.manage",
            "report.view_reviewer", "print.view",
            "form.view", "form.view_assigned",
        ],
        "Reviewer": [
            "submission.view", "submission.request_changes",
            "review.view", "review.manage",
            "report.view_reviewer",
            "form.view", "form.view_assigned",
        ],
        "Research User": [
            "submission.create", "submission.view_own",
            "submission.edit_draft", "submission.submit",
            "submission.resubmit",
            "form.view_assigned",
            "report.view_user",
            "print.view",
        ],
    }

    role_objects = {}
    for role_name, perm_codes in roles_config.items():
        existing_role = db.query(Role).filter(Role.name == role_name).first()
        if existing_role:
            role_objects[role_name] = existing_role
            # Update permissions if needed
            existing_perm_ids = {rp.permission_id for rp in existing_role.role_permissions}
            for code in perm_codes:
                if code in perms and perms[code].id not in existing_perm_ids:
                    rp = RolePermission(role_id=existing_role.id, permission_id=perms[code].id)
                    db.add(rp)
        else:
            role = Role(name=role_name, description=f"{role_name} role")
            db.add(role)
            db.flush()
            for code in perm_codes:
                if code in perms:
                    rp = RolePermission(role_id=role.id, permission_id=perms[code].id)
                    db.add(rp)
            role_objects[role_name] = role

    db.commit()
    print(f"  Created/verified {len(role_objects)} roles")
    return role_objects


def seed_users(db, roles):
    """Create default users with role assignments."""
    users_config = [
        ("admin", "admin@glp-forms.local", "System Administrator", "Administrator"),
        ("approver1", "approver1@glp-forms.local", "Sarah Approver", "Approver"),
        ("reviewer1", "reviewer1@glp-forms.local", "James Reviewer", "Reviewer"),
        ("researcher1", "researcher1@glp-forms.local", "Dr. Alice Researcher", "Research User"),
        ("researcher2", "researcher2@glp-forms.local", "Dr. Bob Scientist", "Research User"),
    ]

    for username, email, full_name, role_name in users_config:
        existing = db.query(User).filter(User.username == username).first()
        if not existing:
            user = User(
                username=username,
                email=email,
                full_name=full_name,
                password_hash=get_password_hash("password123"),
                is_active=True,
            )
            db.add(user)
            db.flush()

            if role_name in roles:
                ur = UserRole(user_id=user.id, role_id=roles[role_name].id)
                db.add(ur)
            print(f"  Created user: {username} ({full_name}) - Role: {role_name}")
        else:
            print(f"  User already exists: {username}")

    db.commit()


def seed_forms(db):
    """Create sample forms with field definitions."""
    forms_config = [
        {
            "code": "MPAI",
            "name": "Research Data Entry",
            "description": "Record research experiment data including methodology and observations",
            "prefix": "REQ-MPAI",
            "fields": [
                {"name": "project_title", "label": "Project Title", "type": "text", "required": True, "order": 1},
                {"name": "principal_investigator", "label": "Principal Investigator", "type": "text", "required": True, "order": 2},
                {"name": "experiment_date", "label": "Experiment Date", "type": "date", "required": True, "order": 3},
                {"name": "sample_count", "label": "Sample Count", "type": "number", "required": True, "order": 4,
                 "validation": {"min": 1}},
                {"name": "methodology", "label": "Methodology", "type": "select", "required": True, "order": 5,
                 "options": ["Standard Protocol", "High Throughput", "Manual Analysis", "Automated Assay"]},
                {"name": "observations", "label": "Observations", "type": "textarea", "required": False, "order": 6},
                {"name": "quality_rating", "label": "Data Quality Rating", "type": "rating", "required": True, "order": 7},
            ],
        },
    ]

    form_objects = {}
    for fc in forms_config:
        existing = db.query(Form).filter(Form.form_code == fc["code"]).first()
        if existing:
            form_objects[fc["code"]] = existing
            print(f"  Form already exists: {fc['code']} - {fc['name']}")
        else:
            form = Form(
                form_code=fc["code"],
                name=fc["name"],
                description=fc["description"],
                is_active=True,
                requires_approval=True,
                approval_levels=1,
                print_scale=0.94,
            )
            db.add(form)
            db.flush()

            for field in fc["fields"]:
                fd = FormFieldDefinition(
                    form_id=form.id,
                    field_name=field["name"],
                    field_label=field["label"],
                    field_type=field["type"],
                    is_required=field["required"],
                    validation_rules=field.get("validation"),
                    display_order=field["order"],
                    options=field.get("options"),
                )
                db.add(fd)

            # Create request numbering
            rn = RequestNumbering(
                form_id=form.id,
                prefix=fc["prefix"],
                year_reset=True,
                current_sequence=0,
                current_year=0,
            )
            db.add(rn)

            form_objects[fc["code"]] = form
            print(f"  Created form: {fc['code']} - {fc['name']} with {len(fc['fields'])} fields")

    db.commit()
    return form_objects


def seed_assignments(db, forms):
    """Assign forms to research users."""
    researchers = db.query(User).join(UserRole, User.id == UserRole.user_id).join(Role).filter(Role.name == "Research User").all()

    for form_code, form in forms.items():
        for user in researchers:
            existing = db.query(FormAssignment).filter(
                FormAssignment.form_id == form.id,
                FormAssignment.user_id == user.id,
            ).first()
            if not existing:
                fa = FormAssignment(form_id=form.id, user_id=user.id)
                db.add(fa)
                print(f"  Assigned {form_code} to {user.username}")

    db.commit()


def main():
    print("Seeding database...")
    db = SessionLocal()
    try:
        print("\n[1/5] Creating permissions...")
        perms = seed_permissions(db)

        print("\n[2/5] Creating roles...")
        roles = seed_roles(db, perms)

        print("\n[3/5] Creating users...")
        seed_users(db, roles)

        print("\n[4/5] Creating forms...")
        forms = seed_forms(db)

        print("\n[5/5] Assigning forms...")
        seed_assignments(db, forms)

        print("\nSeed complete!")
        print("\nDefault credentials (password: password123):")
        print("  admin / password123 (Administrator)")
        print("  approver1 / password123 (Approver)")
        print("  reviewer1 / password123 (Reviewer)")
        print("  researcher1 / password123 (Research User)")
        print("  researcher2 / password123 (Research User)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
