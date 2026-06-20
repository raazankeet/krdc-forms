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

        # Enrich submission-related entries with request number and form name
        entity_label = None
        entity_form = None
        if log.entity_type == "submission" and log.entity_id:
            try:
                from app.models.submission import Submission
                from app.models.form import Form
                sub = db.query(Submission).filter(Submission.id == int(log.entity_id)).first()
                if sub:
                    entity_label = sub.request_number
                    form = db.query(Form).filter(Form.id == sub.form_id).first()
                    if form:
                        entity_form = form.name
            except (ValueError, TypeError):
                pass

        result.append({
            "id": log.id, "event_id": log.event_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user_id": log.user_id,
            "user_name": user.full_name if user else None,
            "user_role": log.user_role,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "entity_label": entity_label,
            "entity_form": entity_form,
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


@router.get("/request-trail/{request_number}", response_model=dict)
async def request_trail(
    request_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("audit.view")),
):
    """Get the full lifecycle trail of a request by its request number."""
    from app.models.submission import Submission
    from app.models.form import Form
    from app.core.exceptions import NotFoundException

    submission = db.query(Submission).filter(Submission.request_number == request_number).first()
    if not submission:
        raise NotFoundException(f"Request {request_number} not found")

    form = db.query(Form).filter(Form.id == submission.form_id).first()
    submitter = db.query(User).filter(User.id == submission.user_id).first()

    # Get all audit entries for this submission
    logs = db.query(AuditLog).filter(
        AuditLog.entity_type == "submission",
        AuditLog.entity_id == str(submission.id),
    ).order_by(AuditLog.timestamp.asc()).all()

    trail = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        trail.append({
            "id": log.id,
            "event_id": log.event_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "action_label": log.action.replace("submission.", "").replace("_", " ").title(),
            "user_name": actor.full_name if actor else "System",
            "user_role": log.user_role,
            "comment": log.new_value.get("comment") if log.new_value else None,
            "ip_address": log.ip_address,
        })

    return {
        "success": True,
        "data": {
            "request_number": submission.request_number,
            "form_name": form.name if form else None,
            "form_code": form.form_code if form else None,
            "submitter_name": submitter.full_name if submitter else None,
            "current_status": submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "created_at": submission.created_at.isoformat() if submission.created_at else None,
            "trail": trail,
        },
    }
