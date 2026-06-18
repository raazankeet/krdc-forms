from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import math

from app.db.base import get_db
from app.models.user import User, Role, Permission, UserRole, RolePermission
from app.models.form import Form, FormAssignment
from app.schemas.auth import UserCreate, UserUpdate, UserOut, UserListOut, PaginationMeta
from app.core.security import get_password_hash
from app.core.deps import get_current_user, require_permission
from app.core.exceptions import NotFoundException, ConflictException
from app.services.audit import log_event
from app.services.form_assignments import APPROVER_ROLE, REVIEWER_ROLE, SUBMITTER_ROLE, normalize_assignment_role

router = APIRouter()


@router.get("/", response_model=dict)
async def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """List users with pagination, search, and role filter."""
    query = db.query(User)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term))
            | (User.email.ilike(search_term))
            | (User.full_name.ilike(search_term))
        )

    if role:
        query = query.join(UserRole, User.id == UserRole.user_id).join(Role).filter(Role.name == role)

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for user in users:
        roles = []
        for ur in user.user_roles:
            r = db.query(Role).filter(Role.id == ur.role_id).first()
            if r:
                roles.append({
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "permission_count": len(r.role_permissions) if r.role_permissions else 0,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                })

        assigned_form_count = db.query(FormAssignment).filter(FormAssignment.user_id == user.id).count()
        assigned_as_submitter = db.query(FormAssignment).filter(
            FormAssignment.user_id == user.id,
            FormAssignment.role == SUBMITTER_ROLE
        ).count()
        assigned_as_reviewer = db.query(FormAssignment).filter(
            FormAssignment.user_id == user.id,
            FormAssignment.role == REVIEWER_ROLE
        ).count()
        assigned_as_approver = db.query(FormAssignment).filter(
            FormAssignment.user_id == user.id,
            FormAssignment.role == APPROVER_ROLE
        ).count()

        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "roles": roles,
            "assigned_form_count": assigned_form_count,
            "assigned_as_submitter": assigned_as_submitter,
            "assigned_as_reviewer": assigned_as_reviewer,
            "assigned_as_approver": assigned_as_approver,
        })

    return {
        "success": True,
        "data": result,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": total_pages,
        },
    }


@router.post("/", response_model=dict)
async def create_user(
    request: Request,
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Create a new user."""
    # Check uniqueness
    existing = db.query(User).filter(
        (User.username == body.username) | (User.email == body.email)
    ).first()
    if existing:
        raise ConflictException("Username or email already exists")

    # Create user
    user = User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        password_hash=get_password_hash(body.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Assign roles
    for role_id in body.role_ids:
        role = db.query(Role).filter(Role.id == role_id).first()
        if role:
            user_role = UserRole(user_id=user.id, role_id=role_id, assigned_by=current_user.id)
            db.add(user_role)

    db.commit()
    db.refresh(user)

    await log_event(
        db=db, user=current_user, action="user.created",
        entity_type="user", entity_id=str(user.id),
        new_value={"username": user.username, "email": user.email},
        request=request,
    )

    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    }


@router.get("/{user_id}", response_model=dict)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Get user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    roles = []
    for ur in user.user_roles:
        r = db.query(Role).filter(Role.id == ur.role_id).first()
        if r:
            perms = []
            for rp in r.role_permissions:
                perm = db.query(Permission).filter(Permission.id == rp.permission_id).first()
                if perm:
                    perms.append({"id": perm.id, "code": perm.code, "description": perm.description, "resource": perm.resource, "action": perm.action})
            roles.append({"id": r.id, "name": r.name, "description": r.description, "permissions": perms, "created_at": r.created_at.isoformat() if r.created_at else None})

    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "roles": roles,
        },
    }


@router.put("/{user_id}", response_model=dict)
async def update_user(
    user_id: int,
    body: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Update user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    old_data = {"email": user.email, "full_name": user.full_name, "is_active": user.is_active}

    if body.email is not None:
        existing = db.query(User).filter(User.email == body.email, User.id != user_id).first()
        if existing:
            raise ConflictException("Email already in use")
        user.email = body.email
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.password is not None:
        user.password_hash = get_password_hash(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active

    # Update roles if provided
    if body.role_ids is not None:
        # Remove existing roles
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        # Add new roles
        for role_id in body.role_ids:
            role = db.query(Role).filter(Role.id == role_id).first()
            if role:
                user_role = UserRole(user_id=user.id, role_id=role_id, assigned_by=current_user.id)
                db.add(user_role)

    db.commit()
    db.refresh(user)

    new_data = {"email": user.email, "full_name": user.full_name, "is_active": user.is_active}
    await log_event(
        db=db, user=current_user, action="user.updated",
        entity_type="user", entity_id=str(user.id),
        old_value=old_data, new_value=new_data,
        request=request,
    )

    return {"success": True, "data": {"id": user.id, "message": "User updated successfully"}}


@router.delete("/{user_id}", response_model=dict)
async def disable_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Soft-disable a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    user.is_active = False
    db.commit()

    await log_event(
        db=db, user=current_user, action="user.disabled",
        entity_type="user", entity_id=str(user.id),
        request=request,
    )

    return {"success": True, "data": {"message": "User disabled successfully"}}


@router.get("/{user_id}/submissions", response_model=dict)
async def get_user_submissions(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Get a user's submission history."""
    from app.models.submission import Submission

    query = db.query(Submission).filter(Submission.user_id == user_id)
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = query.order_by(Submission.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "request_number": s.request_number,
                "status": s.status.value if hasattr(s.status, 'value') else s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in submissions
        ],
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages},
    }


@router.get("/{user_id}/assigned-forms", response_model=dict)
async def get_user_assigned_forms(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Get forms assigned to a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    assignments = db.query(FormAssignment).filter(FormAssignment.user_id == user_id).all()
    forms = []
    for a in assignments:
        form = db.query(Form).filter(Form.id == a.form_id).first()
        if form:
            forms.append({
                "id": form.id,
                "form_code": form.form_code,
                "name": form.name,
                "is_active": form.is_active,
                "role": normalize_assignment_role(a.role),
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            })

    return {"success": True, "data": forms}


@router.post("/{user_id}/assign-forms", response_model=dict)
async def assign_forms_to_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("user.manage")),
):
    """Assign forms to a user. Replaces all existing assignments."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    body = await request.json()
    # Support both formats: [{id, role}] or {form_ids: [...]}.
    if "forms" in body:
        form_entries = body["forms"]
    else:
        form_ids = body.get("form_ids", [])
        form_entries = [{"id": fid, "role": SUBMITTER_ROLE} for fid in form_ids]

    # Remove existing assignments
    db.query(FormAssignment).filter(FormAssignment.user_id == user_id).delete()

    # Add new assignments
    for entry in form_entries:
        fid = entry["id"] if isinstance(entry, dict) else entry
        role = normalize_assignment_role(entry.get("role", SUBMITTER_ROLE) if isinstance(entry, dict) else SUBMITTER_ROLE)
        form = db.query(Form).filter(Form.id == fid).first()
        if form:
            fa = FormAssignment(form_id=fid, user_id=user_id, role=role, assigned_by=current_user.id)
            db.add(fa)

    db.commit()

    await log_event(
        db=db, user=current_user, action="user.forms_assigned",
        entity_type="user", entity_id=str(user.id),
        new_value={"assignments": [{"form_id": e["id"] if isinstance(e, dict) else e, "role": normalize_assignment_role(e.get("role", SUBMITTER_ROLE) if isinstance(e, dict) else SUBMITTER_ROLE)} for e in form_entries]},
        request=request,
    )

    return {"success": True, "data": {"message": f"Assigned {len(form_entries)} form(s) to user"}}
