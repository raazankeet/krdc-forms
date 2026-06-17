from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from app.db.base import get_db
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/admin/dashboard", response_model=dict)
async def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin dashboard statistics."""
    is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)
    if not is_admin:
        # Return minimal data for non-admins
        return {"success": True, "data": {"active_users": 0, "total_forms": 0, "total_submissions": 0}}

    active_users = db.query(User).filter(User.is_active == True).count()
    from app.models.form import Form
    total_forms = db.query(Form).count()
    total_submissions = db.query(Submission).count()

    # Submissions by status
    status_counts = {}
    for status in SubmissionStatus:
        count = db.query(Submission).filter(Submission.status == status).count()
        status_counts[status.value] = count

    # Approval rate
    approved = status_counts.get("approved", 0)
    total_decided = approved + status_counts.get("rejected", 0)
    approval_rate = round((approved / total_decided * 100), 1) if total_decided > 0 else 0

    # Average review time
    reviewed = db.query(Submission).filter(
        Submission.reviewed_at.isnot(None),
        Submission.submitted_at.isnot(None),
    ).all()
    avg_review_hours = 0
    if reviewed:
        diffs = [(r.reviewed_at - r.submitted_at).total_seconds() / 3600 for r in reviewed if r.reviewed_at and r.submitted_at]
        avg_review_hours = round(sum(diffs) / len(diffs), 1) if diffs else 0

    # Submissions by form
    from app.models.form import Form
    forms = db.query(Form).all()
    submissions_by_form = [{"form_name": f.name, "count": len(f.submissions) if f.submissions else 0} for f in forms]

    return {"success": True, "data": {
        "active_users": active_users,
        "total_forms": total_forms,
        "total_submissions": total_submissions,
        "submissions_by_status": status_counts,
        "submissions_by_form": submissions_by_form,
        "approval_rate_pct": approval_rate,
        "avg_review_time_hours": avg_review_hours,
    }}


@router.get("/reviewer/dashboard", response_model=dict)
async def reviewer_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reviewer dashboard statistics."""
    is_review_user = any(ur.role.name in ["Administrator", "Reviewer", "Approver"] for ur in current_user.user_roles)
    if not is_review_user:
        return {"success": True, "data": {}}

    pending = db.query(Submission).filter(
        Submission.status.in_([SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW])
    ).count()

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    reviewed_today = db.query(Submission).filter(
        Submission.current_assignee == current_user.id,
        Submission.reviewed_at >= today,
    ).count()

    total_decided = db.query(Submission).filter(
        Submission.status.in_([SubmissionStatus.APPROVED, SubmissionStatus.REJECTED])
    ).count()
    rejected = db.query(Submission).filter(Submission.status == SubmissionStatus.REJECTED).count()
    rejection_rate = round((rejected / total_decided * 100), 1) if total_decided > 0 else 0

    return {"success": True, "data": {
        "pending_reviews": pending,
        "reviewed_today": reviewed_today,
        "rejection_rate_pct": rejection_rate,
    }}


@router.get("/user/dashboard", response_model=dict)
async def user_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User dashboard - my submissions summary."""
    my_submissions = db.query(Submission).filter(Submission.user_id == current_user.id)

    total = my_submissions.count()
    drafts = my_submissions.filter(Submission.status == SubmissionStatus.DRAFT).count()
    submitted = my_submissions.filter(Submission.status == SubmissionStatus.SUBMITTED).count()
    approved = my_submissions.filter(Submission.status == SubmissionStatus.APPROVED).count()
    rejected = my_submissions.filter(Submission.status == SubmissionStatus.REJECTED).count()
    needs_correction = my_submissions.filter(Submission.status == SubmissionStatus.NEEDS_CORRECTION).count()

    # Recent activity
    recent = my_submissions.order_by(Submission.updated_at.desc()).limit(10).all()
    recent_activity = [
        {"id": s.id, "request_number": s.request_number,
         "status": s.status.value if hasattr(s.status, 'value') else s.status,
         "updated_at": s.updated_at.isoformat() if s.updated_at else None}
        for s in recent
    ]

    return {"success": True, "data": {
        "my_submissions_total": total,
        "drafts": drafts,
        "submitted": submitted,
        "approved": approved,
        "rejected": rejected,
        "needs_correction": needs_correction,
        "recent_activity": recent_activity,
    }}
