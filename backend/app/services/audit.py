import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User


async def log_event(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Create an immutable audit log entry."""
    ip_address = None
    if request:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip_address = forwarded.split(",")[0].strip()
        elif request.client:
            ip_address = request.client.host

    user_role = None
    if user and user.user_roles:
        user_role = user.user_roles[0].role.name if user.user_roles else None

    audit_entry = AuditLog(
        event_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc),
        user_id=user.id if user else None,
        user_role=user_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
    )

    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


def query_audit_logs(
    db: Session,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Query audit logs with filters."""
    query = db.query(AuditLog)

    if date_from:
        query = query.filter(AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(AuditLog.timestamp <= date_to)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    total = query.count()
    total_pages = (total + page_size - 1) // page_size
    logs = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return logs, total, total_pages
