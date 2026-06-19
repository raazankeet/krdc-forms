from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.db.base import get_db
from app.models.user import User
from app.models.form import Form
from app.models.submission import (
    Submission, SubmissionVersion, SubmissionComment, WorkflowAction,
    SubmissionStatus, WorkflowActionType, CommentType
)
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException, WorkflowException
from app.models.form import RequestNumbering
from app.services.workflow import validate_transition
from app.services.audit import log_event
from app.services.form_validation import validate_submission_payload
from app.services.numbering import generate_request_number, is_draft_request_number
from app.services.form_assignments import APPROVER_ROLE, REVIEWER_ROLE, SUBMITTER_ROLE, has_assignment_role

router = APIRouter()


class WorkflowBody(BaseModel):
    comment: Optional[str] = None


def _role_names(user: User) -> set[str]:
    return {user_role.role.name for user_role in user.user_roles}


def _is_admin_only_user(user: User) -> bool:
    role_names = _role_names(user)
    return "Administrator" in role_names and not ({"Reviewer", "Approver", "Research User"} & role_names)


def _ensure_not_admin_operator(current_user: User) -> None:
    if _is_admin_only_user(current_user):
        raise WorkflowException("Administrators can manage access, but they cannot submit, review, or approve requests")


def _ensure_form_assignment(db: Session, *, submission: Submission, user: User, role: str, error_message: str) -> None:
    if not has_assignment_role(db, form_id=submission.form_id, user_id=user.id, role=role):
        raise WorkflowException(error_message)


def _has_meaningful_version_data(version: SubmissionVersion | None) -> bool:
    if not version or not isinstance(version.data, dict):
        return False
    return any(value not in (None, "", [], {}, ()) for value in version.data.values())


def _get_latest_submission_data(submission: Submission) -> dict:
    if not submission.versions:
        return {}
    ranked_versions = sorted(
        submission.versions,
        key=lambda version: (
            version.version_number,
            version.created_at or datetime.min.replace(tzinfo=timezone.utc),
            version.id,
        ),
        reverse=True,
    )
    latest_version = next((version for version in ranked_versions if _has_meaningful_version_data(version)), ranked_versions[0])
    return latest_version.data or {}


def _validate_submission_before_send(db: Session, submission: Submission) -> None:
    form = db.query(Form).filter(Form.id == submission.form_id).first()
    if not form:
        raise NotFoundException("Form not found for this submission")

    payload = _get_latest_submission_data(submission)
    validation_errors = validate_submission_payload(form, payload)
    if validation_errors:
        raise WorkflowException(
            "Submission is incomplete. Fill all required fields before sending it for review.\n"
            + "\n".join(f"- {error}" for error in validation_errors)
        )


def _assign_official_request_number_if_needed(db: Session, submission: Submission) -> None:
    if not is_draft_request_number(submission.request_number):
        return

    numbering = db.query(RequestNumbering).filter(RequestNumbering.form_id == submission.form_id).first()
    if numbering:
        submission.request_number = generate_request_number(db, submission.form_id, numbering.prefix, numbering.year_reset)
    else:
        form = db.query(Form).filter(Form.id == submission.form_id).first()
        if not form:
            raise NotFoundException("Form not found for this submission")
        submission.request_number = generate_request_number(db, submission.form_id, f"REQ-{form.form_code}", True)


@router.post("/submissions/{submission_id}/workflow/submit", response_model=dict)
async def submit_submission(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a draft for review."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")
    _ensure_not_admin_operator(current_user)
    if submission.user_id != current_user.id:
        raise WorkflowException("Only the owner can submit this submission")
    _ensure_form_assignment(
        db,
        submission=submission,
        user=current_user,
        role=SUBMITTER_ROLE,
        error_message="You are not assigned as a submitter for this form",
    )
    _validate_submission_before_send(db, submission)
    _assign_official_request_number_if_needed(db, submission)

    from_status = submission.status
    new_status = validate_transition(from_status, WorkflowActionType.SUBMIT)
    submission.status = new_status
    submission.submitted_at = datetime.now(timezone.utc)
    submission.current_assignee = None
    submission.version_number = max(submission.version_number, 1)

    wf = WorkflowAction(
        submission_id=submission.id, user_id=current_user.id,
        action=WorkflowActionType.SUBMIT, comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
    )
    db.add(wf)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.submitted", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": new_status.value if hasattr(new_status, 'value') else str(new_status)}}


@router.post("/submissions/{submission_id}/workflow/start-review", response_model=dict)
async def start_review(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign submission for review."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")
    _ensure_not_admin_operator(current_user)

    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names

    if submission.status == SubmissionStatus.SUBMITTED:
        if not is_reviewer:
            raise WorkflowException("Only assigned reviewers can start this review stage")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=REVIEWER_ROLE,
            error_message="You are not assigned as a reviewer for this form",
        )
    elif submission.status == SubmissionStatus.UNDER_REVIEW:
        if not is_approver:
            raise WorkflowException("Only assigned approvers can start the approval stage")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=APPROVER_ROLE,
            error_message="You are not assigned as an approver for this form",
        )
    else:
        raise WorkflowException("This request is not available to start review")

    if submission.current_assignee and submission.current_assignee != current_user.id:
        raise WorkflowException("This submission is already being handled by another user")

    from_status = submission.status
    submission.current_assignee = current_user.id
    submission.reviewed_at = datetime.now(timezone.utc)

    wf = WorkflowAction(
        submission_id=submission.id,
        user_id=current_user.id,
        action=WorkflowActionType.START_REVIEW,
        comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
    )
    db.add(wf)

    db.commit()

    await log_event(db=db, user=current_user, action="submission.review_started", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": from_status.value if hasattr(from_status, 'value') else str(from_status)}}


@router.post("/submissions/{submission_id}/workflow/approve", response_model=dict)
async def approve_submission(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission: raise NotFoundException("Submission not found")

    _ensure_not_admin_operator(current_user)
    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names
    if not is_reviewer and not is_approver:
        raise WorkflowException("Only reviewers and approvers can complete approval actions")
    if submission.current_assignee and submission.current_assignee != current_user.id:
        raise WorkflowException("Only the assigned user can complete this action")
    if not submission.current_assignee:
        raise WorkflowException("Start review before completing this action")

    from_status = submission.status
    if from_status == SubmissionStatus.SUBMITTED:
        if not is_reviewer:
            raise WorkflowException("Only the assigned reviewer can complete the review stage")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=REVIEWER_ROLE,
            error_message="You are not assigned as a reviewer for this form",
        )
        new_status = validate_transition(from_status, WorkflowActionType.APPROVE)
        submission.status = new_status
        submission.current_assignee = None
        submission.reviewed_at = datetime.now(timezone.utc)
    elif from_status == SubmissionStatus.UNDER_REVIEW:
        if not is_approver:
            raise WorkflowException("Only the assigned approver can approve this request")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=APPROVER_ROLE,
            error_message="You are not assigned as an approver for this form",
        )
        new_status = validate_transition(from_status, WorkflowActionType.APPROVE)
        submission.status = new_status
        submission.approved_at = datetime.now(timezone.utc)
        submission.current_assignee = None
    else:
        raise WorkflowException("This request is not ready for approval")

    # Create approved snapshot
    if new_status == SubmissionStatus.APPROVED and submission.versions:
        ranked_versions = sorted(
            submission.versions,
            key=lambda version: (
                version.version_number,
                version.created_at or datetime.min.replace(tzinfo=timezone.utc),
                version.id,
            ),
            reverse=True,
        )
        latest = next((version for version in ranked_versions if _has_meaningful_version_data(version)), ranked_versions[0])
        snapshot = SubmissionVersion(
            submission_id=submission.id,
            version_number=submission.version_number,
            data=latest.data,
            created_by=current_user.id,
            is_approved_snapshot=True,
        )
        db.add(snapshot)

    wf = WorkflowAction(
        submission_id=submission.id, user_id=current_user.id,
        action=WorkflowActionType.APPROVE, comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
    )
    db.add(wf)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.approved", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": "approved"}}


@router.post("/submissions/{submission_id}/workflow/reject", response_model=dict)
async def reject_submission(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a submission."""
    if not body.comment:
        raise WorkflowException("Comment is required for rejection")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission: raise NotFoundException("Submission not found")

    _ensure_not_admin_operator(current_user)
    role_names = _role_names(current_user)
    if "Approver" not in role_names:
        raise WorkflowException("Only assigned approvers can reject a request")
    if submission.current_assignee and submission.current_assignee != current_user.id:
        raise WorkflowException("Only the assigned approver can reject this submission")
    if not submission.current_assignee:
        raise WorkflowException("Start review before rejecting this submission")
    if submission.status != SubmissionStatus.UNDER_REVIEW:
        raise WorkflowException("Rejection is available only during the approval stage")
    _ensure_form_assignment(
        db,
        submission=submission,
        user=current_user,
        role=APPROVER_ROLE,
        error_message="You are not assigned as an approver for this form",
    )

    from_status = submission.status
    validate_transition(from_status, WorkflowActionType.REJECT)
    new_status = SubmissionStatus.REJECTED
    submission.status = new_status
    submission.current_assignee = None

    # Add rejection comment
    comment = SubmissionComment(
        submission_id=submission.id, user_id=current_user.id,
        comment=body.comment, comment_type=CommentType.REVIEW,
    )
    db.add(comment)

    wf = WorkflowAction(
        submission_id=submission.id, user_id=current_user.id,
        action=WorkflowActionType.REJECT, comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
    )
    db.add(wf)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.rejected", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": "rejected"}}


@router.post("/submissions/{submission_id}/workflow/request-changes", response_model=dict)
async def request_changes(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request changes on a submission."""
    if not body.comment:
        raise WorkflowException("Comment is required when requesting changes")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission: raise NotFoundException("Submission not found")

    _ensure_not_admin_operator(current_user)
    role_names = _role_names(current_user)
    is_reviewer = "Reviewer" in role_names
    is_approver = "Approver" in role_names
    if not is_reviewer and not is_approver:
        raise WorkflowException("Only reviewers and approvers can request changes")
    if submission.current_assignee and submission.current_assignee != current_user.id:
        raise WorkflowException("Only the assigned user can request changes on this submission")
    if not submission.current_assignee:
        raise WorkflowException("Start review before requesting changes")
    if submission.status == SubmissionStatus.SUBMITTED:
        if not is_reviewer:
            raise WorkflowException("Only the assigned reviewer can request changes at this stage")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=REVIEWER_ROLE,
            error_message="You are not assigned as a reviewer for this form",
        )
    elif submission.status == SubmissionStatus.UNDER_REVIEW:
        if not is_approver:
            raise WorkflowException("Only the assigned approver can request changes at this stage")
        _ensure_form_assignment(
            db,
            submission=submission,
            user=current_user,
            role=APPROVER_ROLE,
            error_message="You are not assigned as an approver for this form",
        )
    else:
        raise WorkflowException("This request is not in a review stage that supports requested changes")

    from_status = submission.status
    new_status = validate_transition(from_status, WorkflowActionType.REQUEST_CHANGES)
    submission.status = new_status
    submission.current_assignee = None

    comment = SubmissionComment(
        submission_id=submission.id, user_id=current_user.id,
        comment=body.comment, comment_type=CommentType.CORRECTION_REQUEST,
    )
    db.add(comment)

    wf = WorkflowAction(
        submission_id=submission.id, user_id=current_user.id,
        action=WorkflowActionType.REQUEST_CHANGES, comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
    )
    db.add(wf)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.changes_requested", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": "needs_correction"}}


@router.post("/submissions/{submission_id}/workflow/resubmit", response_model=dict)
async def resubmit_submission(
    submission_id: int,
    body: WorkflowBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resubmit after corrections."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission: raise NotFoundException("Submission not found")
    _ensure_not_admin_operator(current_user)
    if submission.user_id != current_user.id: raise WorkflowException("Only the owner can resubmit")
    _ensure_form_assignment(
        db,
        submission=submission,
        user=current_user,
        role=SUBMITTER_ROLE,
        error_message="You are not assigned as a submitter for this form",
    )
    _validate_submission_before_send(db, submission)
    _assign_official_request_number_if_needed(db, submission)

    from_status = submission.status
    new_status = validate_transition(from_status, WorkflowActionType.RESUBMIT)
    submission.status = new_status
    submission.current_assignee = None
    submission.submitted_at = datetime.now(timezone.utc)

    wf = WorkflowAction(
        submission_id=submission.id, user_id=current_user.id,
        action=WorkflowActionType.RESUBMIT, comment=body.comment,
        from_status=from_status.value if hasattr(from_status, 'value') else str(from_status),
        to_status=new_status.value if hasattr(new_status, 'value') else str(new_status),
    )
    db.add(wf)
    db.commit()

    await log_event(db=db, user=current_user, action="submission.resubmitted", entity_type="submission",
                    entity_id=str(submission.id), request=request)
    return {"success": True, "data": {"status": new_status.value if hasattr(new_status, 'value') else str(new_status)}}


@router.post("/submissions/{submission_id}/comments", response_model=dict)
async def add_comment(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a general comment to a submission."""
    body = await request.json()
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission: raise NotFoundException("Submission not found")

    comment = SubmissionComment(
        submission_id=submission_id, user_id=current_user.id,
        comment=body["comment"], comment_type=CommentType.GENERAL,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {"success": True, "data": {"id": comment.id, "comment": comment.comment,
            "created_at": comment.created_at.isoformat() if comment.created_at else None}}


@router.post("/submissions/{submission_id}/field-comments", response_model=dict)
async def add_field_comment(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an inline field-level comment during review."""
    body = await request.json()
    field_name = body.get("field_name")
    comment_text = body.get("comment")

    if not field_name or not comment_text:
        raise WorkflowException("field_name and comment are required")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")

    _ensure_not_admin_operator(current_user)
    role_names = _role_names(current_user)
    is_reviewer_or_approver = "Reviewer" in role_names or "Approver" in role_names
    is_owner = submission.user_id == current_user.id

    if not is_reviewer_or_approver and not is_owner:
        raise WorkflowException("Only reviewers, approvers, or the submission owner can add field comments")

    if is_reviewer_or_approver:
        # Reviewer/approver must be the assigned user
        if submission.current_assignee != current_user.id:
            raise WorkflowException("Only the assigned reviewer/approver can add field comments")
    elif is_owner:
        # Owner can only reply when submission is in needs_correction
        if submission.status != SubmissionStatus.NEEDS_CORRECTION:
            raise WorkflowException("You can only reply to comments when the submission is returned for correction")

    comment = SubmissionComment(
        submission_id=submission_id,
        user_id=current_user.id,
        comment=comment_text,
        comment_type=CommentType.CORRECTION_REQUEST,
        field_name=field_name,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    user = db.query(User).filter(User.id == current_user.id).first()
    return {
        "success": True,
        "data": {
            "id": comment.id,
            "field_name": comment.field_name,
            "user_id": comment.user_id,
            "user_name": user.full_name if user else None,
            "comment": comment.comment,
            "comment_type": comment.comment_type.value if hasattr(comment.comment_type, 'value') else str(comment.comment_type),
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
        },
    }
