from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import math

from app.db.base import get_db
from app.models.user import User
from app.models.form import Form, RequestNumbering
from app.models.submission import Submission, SubmissionVersion, SubmissionStatus
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException, WorkflowException
from app.services.numbering import build_draft_request_number, generate_request_number
from app.services.audit import log_event

router = APIRouter()


def _has_meaningful_data(version: SubmissionVersion | None) -> bool:
    if not version or not isinstance(version.data, dict):
        return False
    return any(value not in (None, "", [], {}, ()) for value in version.data.values())


def _select_current_version(submission: Submission) -> SubmissionVersion | None:
    if not submission.versions:
        return None

    approved_snapshots = [version for version in submission.versions if version.is_approved_snapshot]
    ranked_versions = sorted(
        submission.versions,
        key=lambda version: (
            version.version_number,
            version.created_at or datetime.min.replace(tzinfo=timezone.utc),
            version.id,
        ),
        reverse=True,
    )

    if submission.status == SubmissionStatus.APPROVED and approved_snapshots:
        ranked_approved_snapshots = sorted(
            approved_snapshots,
            key=lambda version: (
                version.version_number,
                version.created_at or datetime.min.replace(tzinfo=timezone.utc),
                version.id,
            ),
            reverse=True,
        )
        meaningful_snapshot = next((version for version in ranked_approved_snapshots if _has_meaningful_data(version)), None)
        if meaningful_snapshot:
            return meaningful_snapshot

    meaningful_version = next((version for version in ranked_versions if _has_meaningful_data(version)), None)
    if meaningful_version:
        return meaningful_version

    return ranked_versions[0]


@router.get("/", response_model=dict)
async def list_submissions(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    form_id: Optional[int] = None,
    search: Optional[str] = None,
    scope: str = Query("mine"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List submissions filtered by user role."""
    is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)
    query = db.query(Submission)

    if is_admin and scope == "all":
        pass  # Admin all-requests view
    else:
        # "My Submissions" should always show only the current user's own items.
        # Review work is handled through the dedicated /reviews endpoints.
        query = query.filter(Submission.user_id == current_user.id)

    if status:
        query = query.filter(Submission.status == status)
    if form_id:
        query = query.filter(Submission.form_id == form_id)
    if search:
        query = query.filter(Submission.request_number.ilike(f"%{search}%"))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    submissions = query.order_by(Submission.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for s in submissions:
        form = db.query(Form).filter(Form.id == s.form_id).first()
        user = db.query(User).filter(User.id == s.user_id).first()
        result.append({
            "id": s.id,
            "request_number": s.request_number,
            "form_id": s.form_id,
            "form_name": form.name if form else None,
            "form_code": form.form_code if form else None,
            "user_id": s.user_id,
            "submitted_by": user.full_name if user else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "email": user.email,
            } if user else None,
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "version_number": s.version_number,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return {
        "success": True,
        "data": result,
        "pagination": {"page": page, "page_size": page_size, "total": total, "pages": total_pages},
    }


@router.post("/", response_model=dict)
async def create_submission(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new draft submission."""
    body = await request.json()
    form_id = body.get("form_id")
    form_data = body.get("data", {})

    form = db.query(Form).filter(Form.id == form_id, Form.is_active == True).first()
    if not form:
        raise NotFoundException("Form not found or inactive")

    submission = Submission(
        request_number="DRAFT-PENDING",
        form_id=form_id,
        user_id=current_user.id,
        status=SubmissionStatus.DRAFT,
        version_number=1,
    )
    db.add(submission)
    db.flush()
    submission.request_number = build_draft_request_number(submission.id)

    # Create version 1
    version = SubmissionVersion(
        submission_id=submission.id,
        version_number=1,
        data=form_data,
        created_by=current_user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(submission)

    await log_event(db=db, user=current_user, action="submission.created", entity_type="submission",
                    entity_id=str(submission.id), new_value={"request_number": submission.request_number}, request=request)

    return {"success": True, "data": {"id": submission.id, "request_number": submission.request_number}}


@router.get("/{submission_id}", response_model=dict)
async def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full submission details."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")

    form = db.query(Form).filter(Form.id == submission.form_id).first()
    sub_user = db.query(User).filter(User.id == submission.user_id).first()
    current_version = None
    selected_version = _select_current_version(submission)
    if selected_version:
        current_version = {
            "id": selected_version.id,
            "version_number": selected_version.version_number,
            "data": selected_version.data,
        }

    versions = [{"id": v.id, "version_number": v.version_number, "data": v.data,
                 "submission_id": v.submission_id,
                 "created_by": v.created_by, "created_at": v.created_at.isoformat() if v.created_at else None,
                 "is_approved_snapshot": v.is_approved_snapshot} for v in (submission.versions or [])]

    comments = []
    for c in (submission.comments or []):
        cu = db.query(User).filter(User.id == c.user_id).first()
        comments.append({"id": c.id, "submission_id": c.submission_id, "user_id": c.user_id, "user_name": cu.full_name if cu else None,
                        "comment": c.comment, "comment_type": c.comment_type.value if hasattr(c.comment_type, 'value') else c.comment_type,
                        "created_at": c.created_at.isoformat() if c.created_at else None,
                        "user": {
                            "id": cu.id,
                            "username": cu.username,
                            "full_name": cu.full_name,
                            "email": cu.email,
                        } if cu else None})

    workflow = []
    for w in (submission.workflow_actions or []):
        wu = db.query(User).filter(User.id == w.user_id).first()
        workflow.append({"id": w.id, "submission_id": w.submission_id, "user_id": w.user_id, "user_name": wu.full_name if wu else None,
                        "action": w.action.value if hasattr(w.action, 'value') else w.action,
                        "comment": w.comment, "from_status": w.from_status, "to_status": w.to_status,
                        "created_at": w.created_at.isoformat() if w.created_at else None,
                        "user": {
                            "id": wu.id,
                            "username": wu.username,
                            "full_name": wu.full_name,
                            "email": wu.email,
                        } if wu else None})

    assignee = db.query(User).filter(User.id == submission.current_assignee).first() if submission.current_assignee else None

    return {"success": True, "data": {
        "id": submission.id, "request_number": submission.request_number,
        "form_id": submission.form_id,
        "form": {"id": form.id, "form_code": form.form_code, "name": form.name, "print_scale": form.print_scale} if form else None,
        "user_id": submission.user_id, "submitted_by": sub_user.full_name if sub_user else None,
        "user": {
            "id": sub_user.id,
            "username": sub_user.username,
            "full_name": sub_user.full_name,
            "email": sub_user.email,
        } if sub_user else None,
        "status": submission.status.value if hasattr(submission.status, 'value') else submission.status,
        "version_number": submission.version_number,
        "current_assignee": {"id": assignee.id, "full_name": assignee.full_name} if assignee else None,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "reviewed_at": submission.reviewed_at.isoformat() if submission.reviewed_at else None,
        "approved_at": submission.approved_at.isoformat() if submission.approved_at else None,
        "created_at": submission.created_at.isoformat() if submission.created_at else None,
        "updated_at": submission.updated_at.isoformat() if submission.updated_at else None,
        "current_version": current_version,
        "versions": versions,
        "comments": comments,
        "workflow_actions": workflow,
    }}


@router.put("/{submission_id}", response_model=dict)
async def update_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update draft submission data."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")

    if submission.status not in [SubmissionStatus.DRAFT, SubmissionStatus.NEEDS_CORRECTION, SubmissionStatus.REJECTED]:
        raise WorkflowException("Only draft or returned submissions can be edited")

    if submission.user_id != current_user.id:
        is_admin = any(ur.role.name == "Administrator" for ur in current_user.user_roles)
        if not is_admin:
            raise WorkflowException("You can only edit your own submissions")

    body = await request.json()
    new_data = body.get("data", {})

    new_version_num = submission.version_number + 1
    version = SubmissionVersion(
        submission_id=submission.id,
        version_number=new_version_num,
        data=new_data,
        created_by=current_user.id,
    )
    db.add(version)
    submission.version_number = new_version_num
    db.commit()

    await log_event(db=db, user=current_user, action="submission.updated", entity_type="submission",
                    entity_id=str(submission.id), new_value={"version": new_version_num}, request=request)

    return {"success": True, "data": {"version_number": new_version_num}}


@router.delete("/{submission_id}", response_model=dict)
async def delete_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a draft submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")
    if submission.status != SubmissionStatus.DRAFT:
        raise WorkflowException("Only draft submissions can be deleted")

    db.delete(submission)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.deleted", entity_type="submission",
                    entity_id=str(submission_id), request=request)
    return {"success": True, "data": {"message": "Submission deleted"}}
