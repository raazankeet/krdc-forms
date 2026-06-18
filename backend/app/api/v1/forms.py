from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.base import get_db
from app.models.user import User
from app.models.form import Form, FormFieldDefinition, FormAssignment, RequestNumbering
from app.core.deps import get_current_user, require_permission
from app.core.exceptions import NotFoundException, ConflictException
from app.services.audit import log_event
from app.services.form_assignments import (
    APPROVER_ROLE,
    REVIEWER_ROLE,
    SUBMITTER_ROLE,
    get_assigned_user_ids,
    group_assignment_ids,
)

router = APIRouter()

MIN_PRINT_SCALE = 0.0
MAX_PRINT_SCALE = 1.0


def _normalize_print_scale(value) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = 0.94
    return max(MIN_PRINT_SCALE, min(MAX_PRINT_SCALE, round(parsed, 2)))


@router.get("/", response_model=dict)
async def list_forms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List forms accessible to the current user."""
    # Admin sees all, researchers see assigned forms
    is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)

    if is_admin:
        forms = db.query(Form).filter(Form.form_code == "MPAI").all()
    else:
        assigned_form_ids = (
            db.query(FormAssignment.form_id)
            .filter(FormAssignment.user_id == current_user.id)
            .subquery()
        )
        forms = db.query(Form).filter(
            Form.id.in_(assigned_form_ids),
            Form.is_active == True,
            Form.form_code == "MPAI",
        ).all()

    result = []
    for form in forms:
        submission_count = len(form.submissions) if form.submissions else 0
        submitters_count = sum(1 for a in (form.assignments or []) if a.role == SUBMITTER_ROLE)
        reviewers_count = sum(1 for a in (form.assignments or []) if a.role == REVIEWER_ROLE)
        approvers_count = sum(1 for a in (form.assignments or []) if a.role == APPROVER_ROLE)
        result.append({
            "id": form.id,
            "form_code": form.form_code,
            "name": form.name,
            "description": form.description,
            "print_scale": form.print_scale,
            "is_active": form.is_active,
            "requires_approval": form.requires_approval,
            "approval_levels": form.approval_levels,
            "submission_count": submission_count,
            "submitters_count": submitters_count,
            "reviewers_count": reviewers_count,
            "approvers_count": approvers_count,
            "created_at": form.created_at.isoformat() if form.created_at else None,
            "updated_at": form.updated_at.isoformat() if form.updated_at else None,
        })

    return {"success": True, "data": result}


@router.post("/", response_model=dict)
async def create_form(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("form.manage")),
):
    """Create a new form."""
    body = await request.json()

    existing = db.query(Form).filter(Form.form_code == body.get("form_code")).first()
    if existing:
        raise ConflictException("Form code already exists")

    form = Form(
        form_code=body["form_code"],
        name=body["name"],
        description=body.get("description", ""),
        is_active=body.get("is_active", True),
        requires_approval=body.get("requires_approval", True),
        approval_levels=body.get("approval_levels", 1),
        print_scale=_normalize_print_scale(body.get("print_scale", 0.94)),
        created_by=current_user.id,
    )
    db.add(form)
    db.flush()

    # Create field definitions
    for idx, field in enumerate(body.get("fields", [])):
        fd = FormFieldDefinition(
            form_id=form.id,
            field_name=field["field_name"],
            field_label=field["field_label"],
            field_type=field.get("field_type", "text"),
            is_required=field.get("is_required", False),
            validation_rules=field.get("validation_rules"),
            display_order=field.get("display_order", idx),
            options=field.get("options"),
            default_value=str(field.get("default_value")) if field.get("default_value") is not None else None,
        )
        db.add(fd)

    # Create request numbering
    numbering_config = body.get("numbering", {})
    rn = RequestNumbering(
        form_id=form.id,
        prefix=numbering_config.get("prefix", f"REQ-{form.form_code}"),
        year_reset=numbering_config.get("year_reset", True),
        current_sequence=0,
        current_year=0,
    )
    db.add(rn)

    db.commit()
    db.refresh(form)

    await log_event(db=db, user=current_user, action="form.created", entity_type="form", entity_id=str(form.id),
                    new_value={"form_code": form.form_code, "name": form.name}, request=request)

    return {"success": True, "data": {"id": form.id, "form_code": form.form_code, "name": form.name}}


@router.get("/{form_id}", response_model=dict)
async def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get form details with fields and numbering."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise NotFoundException("Form not found")

    fields = [{"id": f.id, "form_id": f.form_id, "field_name": f.field_name, "field_label": f.field_label,
               "field_type": f.field_type, "is_required": f.is_required, "validation_rules": f.validation_rules,
               "display_order": f.display_order, "options": f.options, "default_value": f.default_value}
              for f in (form.fields or [])]

    numbering = None
    if form.numbering:
        numbering = {"id": form.numbering.id, "prefix": form.numbering.prefix, "year_reset": form.numbering.year_reset,
                     "current_sequence": form.numbering.current_sequence, "current_year": form.numbering.current_year}

    return {"success": True, "data": {
        "id": form.id, "form_code": form.form_code, "name": form.name, "description": form.description,
        "print_scale": form.print_scale,
        "is_active": form.is_active, "requires_approval": form.requires_approval,
        "approval_levels": form.approval_levels, "fields": fields, "numbering": numbering,
        "created_at": form.created_at.isoformat() if form.created_at else None,
        "updated_at": form.updated_at.isoformat() if form.updated_at else None,
    }}


@router.put("/{form_id}", response_model=dict)
async def update_form(form_id: int, request: Request, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user), _: None = Depends(require_permission("form.manage"))):
    """Update form metadata."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise NotFoundException("Form not found")

    body = await request.json()
    if "name" in body: form.name = body["name"]
    if "description" in body: form.description = body["description"]
    if "requires_approval" in body: form.requires_approval = body["requires_approval"]
    if "approval_levels" in body: form.approval_levels = body["approval_levels"]
    if "print_scale" in body: form.print_scale = _normalize_print_scale(body["print_scale"])

    db.commit()
    await log_event(db=db, user=current_user, action="form.updated", entity_type="form", entity_id=str(form.id), request=request)
    return {"success": True, "data": {"message": "Form updated"}}


@router.put("/{form_id}/toggle", response_model=dict)
async def toggle_form(form_id: int, request: Request, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user), _: None = Depends(require_permission("form.manage"))):
    """Enable or disable a form."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form: raise NotFoundException("Form not found")
    form.is_active = not form.is_active
    db.commit()
    await log_event(db=db, user=current_user, action="form.toggled", entity_type="form", entity_id=str(form.id),
                    new_value={"is_active": form.is_active}, request=request)
    return {"success": True, "data": {"is_active": form.is_active}}


@router.post("/{form_id}/assign", response_model=dict)
async def assign_form(form_id: int, request: Request, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user), _: None = Depends(require_permission("form.manage"))):
    """Assign submitters, reviewers, and approvers to a form. Full replacement."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form: raise NotFoundException("Form not found")

    body = await request.json()
    grouped_ids = group_assignment_ids(
        submitters=body.get("submitters", []),
        reviewers=body.get("reviewers", []),
        approvers=body.get("approvers", []),
    )

    # Full replacement: remove all existing assignments for this form
    db.query(FormAssignment).filter(FormAssignment.form_id == form_id).delete()

    for role, user_ids in grouped_ids.items():
        for uid in user_ids:
            db.add(FormAssignment(form_id=form_id, user_id=uid, role=role, assigned_by=current_user.id))

    db.commit()
    await log_event(db=db, user=current_user, action="form.assigned", entity_type="form", entity_id=str(form.id),
                    new_value=grouped_ids, request=request)
    return {
        "success": True,
        "data": {
            "submitters_count": len(grouped_ids[SUBMITTER_ROLE]),
            "reviewers_count": len(grouped_ids[REVIEWER_ROLE]),
            "approvers_count": len(grouped_ids[APPROVER_ROLE]),
        },
    }


@router.get("/{form_id}/assigned-users", response_model=dict)
async def get_assigned_users(form_id: int, db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user), _: None = Depends(require_permission("form.manage"))):
    """Get submitters, reviewers, and approvers assigned to a form."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form: raise NotFoundException("Form not found")

    def build_entries(role: str) -> list[dict]:
        user_ids = get_assigned_user_ids(db, form_id=form_id, role=role)
        users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        user_map = {user.id: user for user in users}
        entries = []
        for user_id in user_ids:
            user = user_map.get(user_id)
            if user:
                entries.append({
                    "id": user.id,
                    "username": user.username,
                    "full_name": user.full_name,
                    "email": user.email,
                })
        return entries

    return {
        "success": True,
        "data": {
            "submitters": build_entries(SUBMITTER_ROLE),
            "reviewers": build_entries(REVIEWER_ROLE),
            "approvers": build_entries(APPROVER_ROLE),
        },
    }
