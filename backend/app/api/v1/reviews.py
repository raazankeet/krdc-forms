from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case
from datetime import datetime, timezone
import math

from app.db.base import get_db
from app.models.user import User
from app.models.submission import Submission, SubmissionStatus, WorkflowAction, WorkflowActionType
from app.models.form import FormAssignment
from app.core.deps import get_current_user
from app.services.form_assignments import APPROVER_ROLE, REVIEWER_ROLE

router = APIRouter()


def _role_names(user: User) -> set[str]:
    return {user_role.role.name for user_role in user.user_roles}


def _serialize_submission_row(db: Session, submission: Submission, *, is_checked_out_by_me: bool | None = None, last_action: str | None = None, handled_at: datetime | None = None) -> dict:
    from app.models.form import Form

    form = db.query(Form).filter(Form.id == submission.form_id).first()
    user = db.query(User).filter(User.id == submission.user_id).first()
    assignee = db.query(User).filter(User.id == submission.current_assignee).first() if submission.current_assignee else None
    return {
        "id": submission.id,
        "request_number": submission.request_number,
        "form_id": submission.form_id,
        "form_name": form.name if form else None,
        "form_code": form.form_code if form else None,
        "submitter_name": user.full_name if user else None,
        "submitter_id": submission.user_id,
        "submitted_by": user.full_name if user else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
        } if user else None,
        "status": submission.status.value if hasattr(submission.status, 'value') else submission.status,
        "current_assignee": {
            "id": assignee.id,
            "full_name": assignee.full_name,
        } if assignee else None,
        "is_checked_out_by_me": is_checked_out_by_me,
        "last_action": last_action,
        "handled_at": handled_at.isoformat() if handled_at else None,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "created_at": submission.created_at.isoformat() if submission.created_at else None,
        "updated_at": submission.updated_at.isoformat() if submission.updated_at else None,
    }


@router.get("/pending", response_model=dict)
async def pending_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get pending review queue."""
    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names
    if not is_reviewer and not is_approver:
        return {"success": True, "data": [], "pagination": {"page": 1, "page_size": 20, "total": 0, "pages": 0}}

    assignment_roles = []
    statuses = []
    if is_reviewer:
        assignment_roles.append(REVIEWER_ROLE)
        statuses.append(SubmissionStatus.SUBMITTED)
    if is_approver:
        assignment_roles.append(APPROVER_ROLE)
        statuses.append(SubmissionStatus.UNDER_REVIEW)

    query = (
        db.query(Submission)
        .join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
        )
        .filter(FormAssignment.role.in_(assignment_roles))
        .filter(Submission.status.in_(statuses))
        .filter(
            (Submission.current_assignee.is_(None))
            | (Submission.current_assignee == current_user.id)
        )
    )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = query.order_by(Submission.submitted_at.asc()).offset((page - 1) * page_size).limit(page_size).all()

    result = [_serialize_submission_row(db, s) for s in submissions]

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}


@router.get("/my", response_model=dict)
async def my_reviews(
    scope: str = Query("active", pattern="^(active|history)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get submissions assigned to current reviewer."""
    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names
    if not is_reviewer and not is_approver:
        return {"success": True, "data": [], "pagination": {"page": 1, "page_size": 20, "total": 0, "pages": 0}}

    if scope == "history":
        history_query = (
            db.query(WorkflowAction, Submission)
            .join(Submission, Submission.id == WorkflowAction.submission_id)
            .join(
                FormAssignment,
                (FormAssignment.form_id == Submission.form_id)
                & (FormAssignment.user_id == current_user.id)
            )
            .filter(WorkflowAction.user_id == current_user.id)
            .filter(
                (
                    (FormAssignment.role == REVIEWER_ROLE)
                    & (WorkflowAction.from_status == SubmissionStatus.SUBMITTED.value)
                    & (WorkflowAction.action.in_([
                        WorkflowActionType.APPROVE,
                        WorkflowActionType.REQUEST_CHANGES,
                    ]))
                )
                | (
                    (FormAssignment.role == APPROVER_ROLE)
                    & (WorkflowAction.from_status == SubmissionStatus.UNDER_REVIEW.value)
                    & (WorkflowAction.action.in_([
                        WorkflowActionType.APPROVE,
                        WorkflowActionType.REJECT,
                        WorkflowActionType.REQUEST_CHANGES,
                    ]))
                )
            )
            .order_by(WorkflowAction.created_at.desc(), WorkflowAction.id.desc())
        )

        latest_by_submission: list[tuple[WorkflowAction, Submission]] = []
        seen_submission_ids: set[int] = set()
        for workflow_action, submission in history_query.all():
            if submission.id in seen_submission_ids:
                continue
            seen_submission_ids.add(submission.id)
            latest_by_submission.append((workflow_action, submission))

        total = len(latest_by_submission)
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        page_rows = latest_by_submission[(page - 1) * page_size: page * page_size]
        result = [
            _serialize_submission_row(
                db,
                submission,
                last_action=workflow_action.action.value if hasattr(workflow_action.action, 'value') else str(workflow_action.action),
                handled_at=workflow_action.created_at,
            )
            for workflow_action, submission in page_rows
        ]

        return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}

    assignment_roles = []
    statuses = []
    if is_reviewer:
        assignment_roles.append(REVIEWER_ROLE)
        statuses.append(SubmissionStatus.SUBMITTED)
    if is_approver:
        assignment_roles.append(APPROVER_ROLE)
        statuses.append(SubmissionStatus.UNDER_REVIEW)

    query = (
        db.query(Submission)
        .join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
        )
        .filter(FormAssignment.role.in_(assignment_roles))
        .filter(Submission.status.in_(statuses))
        .filter(
            (Submission.current_assignee == current_user.id)
            | (Submission.current_assignee.is_(None))
        )
    )
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = (
        query.order_by(
            case((Submission.current_assignee == current_user.id, 0), else_=1),
            Submission.updated_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = [
        _serialize_submission_row(
            db,
            s,
            is_checked_out_by_me=s.current_assignee == current_user.id,
        )
        for s in submissions
    ]

    return {"success": True, "data": result, "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages}}


@router.get("/stats", response_model=dict)
async def review_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get review statistics for reviewers."""
    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names
    if not is_reviewer and not is_approver:
        return {"success": True, "data": {"pending": 0, "under_review": 0, "approved_today": 0, "rejected_today": 0}}

    pending_query = db.query(Submission)
    my_work_query = db.query(Submission).filter(Submission.current_assignee == current_user.id)

    if is_reviewer:
        pending_query = pending_query.join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
            & (FormAssignment.role == REVIEWER_ROLE)
        ).filter(
            Submission.status == SubmissionStatus.SUBMITTED,
            (Submission.current_assignee.is_(None)) | (Submission.current_assignee == current_user.id),
        )
        my_work_query = my_work_query.join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
            & (FormAssignment.role == REVIEWER_ROLE)
        ).filter(Submission.status == SubmissionStatus.SUBMITTED)
    else:
        pending_query = pending_query.join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
            & (FormAssignment.role == APPROVER_ROLE)
        ).filter(
            Submission.status == SubmissionStatus.UNDER_REVIEW,
            (Submission.current_assignee.is_(None)) | (Submission.current_assignee == current_user.id),
        )
        my_work_query = my_work_query.join(
            FormAssignment,
            (FormAssignment.form_id == Submission.form_id)
            & (FormAssignment.user_id == current_user.id)
            & (FormAssignment.role == APPROVER_ROLE)
        ).filter(Submission.status == SubmissionStatus.UNDER_REVIEW)

    pending = pending_query.distinct().count()
    under_review = my_work_query.distinct().count()

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    approved_today = db.query(Submission).filter(
        Submission.status == SubmissionStatus.APPROVED, Submission.approved_at >= today
    ).count()
    rejected_today = db.query(Submission).filter(
        Submission.status == SubmissionStatus.REJECTED, Submission.updated_at >= today
    ).count()

    return {"success": True, "data": {"pending": pending, "under_review": under_review,
            "approved_today": approved_today, "rejected_today": rejected_today}}
