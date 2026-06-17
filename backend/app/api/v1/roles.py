from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.user import User, Role, Permission, RolePermission
from app.schemas.auth import RoleCreate, RoleUpdate
from app.core.deps import get_current_user, require_permission
from app.core.exceptions import NotFoundException, ConflictException
from app.services.audit import log_event

router = APIRouter()


@router.get("/", response_model=dict)
async def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("role.manage")),
):
    """List all roles."""
    roles = db.query(Role).all()
    result = []
    for role in roles:
        result.append({
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "permission_count": len(role.role_permissions) if role.role_permissions else 0,
            "created_at": role.created_at.isoformat() if role.created_at else None,
        })

    return {"success": True, "data": result}


@router.post("/", response_model=dict)
async def create_role(
    body: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("role.manage")),
):
    """Create a new role with permissions."""
    existing = db.query(Role).filter(Role.name == body.name).first()
    if existing:
        raise ConflictException("Role name already exists")

    role = Role(name=body.name, description=body.description)
    db.add(role)
    db.flush()

    for perm_id in body.permission_ids:
        perm = db.query(Permission).filter(Permission.id == perm_id).first()
        if perm:
            rp = RolePermission(role_id=role.id, permission_id=perm_id)
            db.add(rp)

    db.commit()
    db.refresh(role)

    await log_event(
        db=db, user=current_user, action="role.created",
        entity_type="role", entity_id=str(role.id),
        new_value={"name": role.name},
        request=request,
    )

    return {"success": True, "data": {"id": role.id, "name": role.name, "message": "Role created successfully"}}


@router.get("/{role_id}", response_model=dict)
async def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("role.manage")),
):
    """Get role detail with permissions."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found")

    perms = []
    for rp in role.role_permissions:
        perm = db.query(Permission).filter(Permission.id == rp.permission_id).first()
        if perm:
            perms.append({"id": perm.id, "code": perm.code, "description": perm.description, "resource": perm.resource, "action": perm.action})

    return {
        "success": True,
        "data": {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "permissions": perms,
            "created_at": role.created_at.isoformat() if role.created_at else None,
        },
    }


@router.put("/{role_id}", response_model=dict)
async def update_role(
    role_id: int,
    body: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("role.manage")),
):
    """Update a role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role not found")

    if body.name is not None:
        existing = db.query(Role).filter(Role.name == body.name, Role.id != role_id).first()
        if existing:
            raise ConflictException("Role name already exists")
        role.name = body.name
    if body.description is not None:
        role.description = body.description

    if body.permission_ids is not None:
        db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        for perm_id in body.permission_ids:
            perm = db.query(Permission).filter(Permission.id == perm_id).first()
            if perm:
                rp = RolePermission(role_id=role.id, permission_id=perm_id)
                db.add(rp)

    db.commit()

    await log_event(
        db=db, user=current_user, action="role.updated",
        entity_type="role", entity_id=str(role.id),
        request=request,
    )

    return {"success": True, "data": {"message": "Role updated successfully"}}


@router.get("/permissions/list", response_model=dict)
async def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("role.manage")),
):
    """List all available permissions."""
    permissions = db.query(Permission).all()
    return {
        "success": True,
        "data": [
            {"id": p.id, "code": p.code, "description": p.description, "resource": p.resource, "action": p.action}
            for p in permissions
        ],
    }
