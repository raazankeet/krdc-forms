from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import math

from app.db.base import get_db
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/pending", response_model=dict)
async def pending_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get pending review queue."""
    is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)
    is_review_user = is_admin or any(ur.role.name in ["Reviewer", "Approver"] for ur in current_user.user_roles)
    if not is_review_user:
        return {"success": True, "data": [], "pagination": {"page": 1, "page_size": 20, "total": 0, "pages": 0}}

    query = db.query(Submission).filter(Submission.status == SubmissionStatus.SUBMITTED)
    if is_admin:
        query = db.query(Submission).filter(
            (Submission.status == SubmissionStatus.SUBMITTED)
            | (Submission.status == SubmissionStatus.UNDER_REVIEW)
        )
    else:
        query = db.query(Submission).filter(
            (Submission.status == SubmissionStatus.SUBMITTED)
            | (
                (Submission.status == SubmissionStatus.UNDER_REVIEW)
                & (Submission.current_assignee == current_user.id)
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = query.order_by(Submission.submitted_at.asc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for s in submissions:
        from app.models.form import Form
        form = db.query(Form).filter(Form.id == s.form_id).first()
        user = db.query(User).filter(User.id == s.user_id).first()
        result.append({
            "id": s.id, "request_number": s.request_number,
            "form_id": s.form_id,
            "form_name": form.name if form else None,
            "form_code": form.form_code if form else None,
            "submitter_name": user.full_name if user else None,
            "submitter_id": s.user_id,
            "submitted_by": user.full_name if user else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "email": user.email,
            } if user else None,
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}


@router.get("/my", response_model=dict)
async def my_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get submissions assigned to current reviewer."""
    is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)
    query = db.query(Submission).filter(Submission.status == SubmissionStatus.UNDER_REVIEW)
    if not is_admin:
        query = query.filter(Submission.current_assignee == current_user.id)
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = query.order_by(Submission.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for s in submissions:
        from app.models.form import Form
        form = db.query(Form).filter(Form.id == s.form_id).first()
        user = db.query(User).filter(User.id == s.user_id).first()
        result.append({
            "id": s.id, "request_number": s.request_number,
            "form_id": s.form_id,
            "form_name": form.name if form else None,
            "form_code": form.form_code if form else None,
            "submitter_name": user.full_name if user else None,
            "submitted_by": user.full_name if user else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "email": user.email,
            } if user else None,
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}


@router.get("/stats", response_model=dict)
async def review_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get review statistics for reviewers."""
    is_review_user = any(ur.role.name in ["Administrator", "Reviewer", "Approver"] for ur in current_user.user_roles)
    if not is_review_user:
        return {"success": True, "data": {"pending": 0, "under_review": 0, "approved_today": 0, "rejected_today": 0}}

    pending = db.query(Submission).filter(Submission.status == SubmissionStatus.SUBMITTED).count()
    under_review = db.query(Submission).filter(Submission.status == SubmissionStatus.UNDER_REVIEW).count()

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    approved_today = db.query(Submission).filter(
        Submission.status == SubmissionStatus.APPROVED, Submission.approved_at >= today
    ).count()
    rejected_today = db.query(Submission).filter(
        Submission.status == SubmissionStatus.REJECTED, Submission.updated_at >= today
    ).count()

    return {"success": True, "data": {"pending": pending, "under_review": under_review,
            "approved_today": approved_today, "rejected_today": rejected_today}}
