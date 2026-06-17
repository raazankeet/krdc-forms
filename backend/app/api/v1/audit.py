from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.base import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.core.deps import get_current_user, require_permission
from app.services.audit import query_audit_logs

router = APIRouter()


@router.get("/", response_model=dict)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("audit.view")),
):
    """List audit logs with filters."""
    # Parse dates
    dt_from = datetime.fromisoformat(date_from) if date_from else None
    dt_to = datetime.fromisoformat(date_to) if date_to else None

    logs, total, total_pages = query_audit_logs(
        db, date_from=dt_from, date_to=dt_to, user_id=user_id,
        action=action, entity_type=entity_type, entity_id=entity_id,
        page=page, page_size=page_size,
    )

    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        result.append({
            "id": log.id, "event_id": log.event_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user_id": log.user_id,
            "user_name": user.full_name if user else None,
            "user_role": log.user_role,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
        })

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}


@router.get("/entity/{entity_type}/{entity_id}", response_model=dict)
async def entity_audit_trail(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("audit.view")),
):
    """Get audit trail for a specific entity."""
    logs = db.query(AuditLog).filter(
        AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id
    ).order_by(AuditLog.timestamp.asc()).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id, "event_id": log.event_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action, "old_value": log.old_value, "new_value": log.new_value,
            "ip_address": log.ip_address,
        })

    return {"success": True, "data": result}


@router.get("/user/{user_id}", response_model=dict)
async def user_audit_trail(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("audit.view")),
):
    """Get audit trail for a specific user."""
    logs, total, total_pages = query_audit_logs(db, user_id=user_id, page=page, page_size=page_size)
    result = []
    for log in logs:
        result.append({
            "id": log.id, "event_id": log.event_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action, "entity_type": log.entity_type, "entity_id": log.entity_id,
            "ip_address": log.ip_address,
        })

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}
