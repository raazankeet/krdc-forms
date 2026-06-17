"""Standalone seed script."""
import sys, os, logging
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Suppress SQLAlchemy echo logs
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from app.db.base import engine, Base
from app.core.security import get_password_hash

from app.models.user import User, Role, Permission, UserRole, RolePermission
from app.models.form import Form, FormFieldDefinition, FormAssignment, RequestNumbering
from app.models.submission import Submission, SubmissionVersion, SubmissionComment, WorkflowAction
from app.models.audit import AuditLog

from sqlalchemy.orm import Session

# Create tables
Base.metadata.create_all(bind=engine)

print("Seeding database...")
with Session(engine) as db:
    print("[1/5] Creating permissions...")
    perms_data = [
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
    
    pmap = {}
    for code, desc, resource, action in perms_data:
        p = Permission(code=code, description=desc, resource=resource, action=action)
        db.add(p)
        db.flush()
        pmap[code] = p
    db.commit()
    print(f"    Created {len(pmap)} permissions")

    print("[2/5] Creating roles...")
    roles_cfg = {
        "Administrator": list(pmap.keys()),
        "Approver": [
            "submission.view", "submission.approve", "submission.reject",
            "submission.request_changes", "review.view", "review.manage",
            "report.view_reviewer", "print.view", "form.view", "form.view_assigned",
        ],
        "Reviewer": [
            "submission.view", "submission.request_changes",
            "review.view", "review.manage",
            "report.view_reviewer", "form.view", "form.view_assigned",
        ],
        "Research User": [
            "submission.create", "submission.view_own",
            "submission.edit_draft", "submission.submit",
            "submission.resubmit", "form.view_assigned",
            "report.view_user", "print.view",
        ],
    }

    rmap = {}
    for role_name, perm_codes in roles_cfg.items():
        role = Role(name=role_name, description=f"{role_name} role")
        db.add(role)
        db.flush()
        for code in perm_codes:
            if code in pmap:
                rp = RolePermission(role_id=role.id, permission_id=pmap[code].id)
                db.add(rp)
        rmap[role_name] = role
    db.commit()
    print(f"    Created {len(rmap)} roles")

    print("[3/5] Creating users...")
    users_cfg = [
        ("admin", "admin@glp-forms.local", "System Administrator", "Administrator"),
        ("approver1", "approver1@glp-forms.local", "Sarah Approver", "Approver"),
        ("reviewer1", "reviewer1@glp-forms.local", "James Reviewer", "Reviewer"),
        ("researcher1", "researcher1@glp-forms.local", "Dr. Alice Researcher", "Research User"),
        ("researcher2", "researcher2@glp-forms.local", "Dr. Bob Scientist", "Research User"),
    ]

    for username, email, full_name, role_name in users_cfg:
        user = User(
            username=username, email=email, full_name=full_name,
            password_hash=get_password_hash("password123"), is_active=True,
        )
        db.add(user)
        db.flush()
        if role_name in rmap:
            ur = UserRole(user_id=user.id, role_id=rmap[role_name].id)
            db.add(ur)
        print(f"    Created user: {username}")
    db.commit()

    print("[4/5] Creating forms...")
    forms_cfg = [
        {
            "code": "MPAI", "name": "Research Data Entry",
            "description": "Record research experiment data",
            "prefix": "REQ-MPAI",
            "fields": [
                {"name": "project_title", "label": "Project Title", "type": "text", "required": True, "order": 1},
                {"name": "principal_investigator", "label": "Principal Investigator", "type": "text", "required": True, "order": 2},
                {"name": "experiment_date", "label": "Experiment Date", "type": "date", "required": True, "order": 3},
                {"name": "sample_count", "label": "Sample Count", "type": "number", "required": True, "order": 4, "validation": {"min": 1}},
                {"name": "methodology", "label": "Methodology", "type": "select", "required": True, "order": 5,
                 "options": ["Standard Protocol", "High Throughput", "Manual Analysis", "Automated Assay"]},
                {"name": "observations", "label": "Observations", "type": "textarea", "required": False, "order": 6},
                {"name": "quality_rating", "label": "Data Quality Rating", "type": "rating", "required": True, "order": 7},
            ],
        },
    ]

    fmap = {}
    for fc in forms_cfg:
        form = Form(form_code=fc["code"], name=fc["name"], description=fc["description"],
                     is_active=True, requires_approval=True, approval_levels=1, print_scale=0.94)
        db.add(form)
        db.flush()
        for field in fc["fields"]:
            fd = FormFieldDefinition(
                form_id=form.id, field_name=field["name"], field_label=field["label"],
                field_type=field["type"], is_required=field["required"],
                validation_rules=field.get("validation"), display_order=field["order"],
                options=field.get("options"),
            )
            db.add(fd)
        rn = RequestNumbering(form_id=form.id, prefix=fc["prefix"], year_reset=True,
                               current_sequence=0, current_year=0)
        db.add(rn)
        fmap[fc["code"]] = form
        print(f"    Created form: {fc['code']} - {fc['name']}")
    db.commit()

    print("[5/5] Assigning forms to researchers...")
    researchers = db.query(User).join(UserRole, User.id == UserRole.user_id).join(Role).filter(Role.name == "Research User").all()
    for form_code, form in fmap.items():
        for user in researchers:
            fa = FormAssignment(form_id=form.id, user_id=user.id)
            db.add(fa)
            print(f"    Assigned {form_code} to {user.username}")
    db.commit()

print("\nSeed complete!")
print("\nDefault credentials (password: password123):")
print("  admin / password123 (Administrator)")
print("  approver1 / password123 (Approver)")
print("  reviewer1 / password123 (Reviewer)")
print("  researcher1 / password123 (Research User)")
print("  researcher2 / password123 (Research User)")
