from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.base import get_db
from app.models.user import User
from app.models.form import Form
from app.models.submission import Submission, SubmissionStatus
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException, WorkflowException

router = APIRouter()


def _has_meaningful_data(version) -> bool:
    if not version or not isinstance(version.data, dict):
        return False
    return any(value not in (None, "", [], {}, ()) for value in version.data.values())


def _select_print_version(submission: Submission):
    if not submission.versions:
        return None

    approved_snapshots = [version for version in submission.versions if version.is_approved_snapshot]
    ranked_versions = sorted(
        submission.versions,
        key=lambda version: (version.version_number, version.created_at or datetime.min.replace(tzinfo=timezone.utc), version.id),
        reverse=True,
    )

    if approved_snapshots:
        ranked_approved_snapshots = sorted(
            approved_snapshots,
            key=lambda version: (version.version_number, version.created_at or datetime.min.replace(tzinfo=timezone.utc), version.id),
            reverse=True,
        )
        meaningful_snapshot = next((version for version in ranked_approved_snapshots if _has_meaningful_data(version)), None)
        if meaningful_snapshot:
            return meaningful_snapshot

    meaningful_version = next((version for version in ranked_versions if _has_meaningful_data(version)), None)
    if meaningful_version:
        return meaningful_version

    return ranked_versions[0]


@router.get("/submissions/{submission_id}/print/data", response_model=dict)
async def get_print_data(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get structured data for printing an approved submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise NotFoundException("Submission not found")

    if submission.status != SubmissionStatus.APPROVED:
        raise WorkflowException("Only approved submissions can be printed")

    form = db.query(Form).filter(Form.id == submission.form_id).first()
    submitter = db.query(User).filter(User.id == submission.user_id).first()

    # Build field data from latest version
    field_data = []
    selected_version = _select_print_version(submission)
    if selected_version:
        data = selected_version.data or {}
        if form and form.fields:
            for field in sorted(form.fields, key=lambda f: f.display_order):
                value = data.get(field.field_name, "")
                field_data.append({
                    "label": field.field_label,
                    "value": str(value) if value is not None else "",
                })

    # Approval chain
    approval_chain = []
    for wf in (submission.workflow_actions or []):
        wf_user = db.query(User).filter(User.id == wf.user_id).first()
        approval_chain.append({
            "name": wf_user.full_name if wf_user else "Unknown",
            "user": wf_user.full_name if wf_user else "Unknown",
            "action": wf.action.value if hasattr(wf.action, 'value') else str(wf.action),
            "date": wf.created_at.isoformat() if wf.created_at else None,
            "timestamp": wf.created_at.isoformat() if wf.created_at else None,
        })

    # Get the approval audit reference
    from app.models.audit import AuditLog
    approval_audit = db.query(AuditLog).filter(
        AuditLog.entity_type == "submission",
        AuditLog.entity_id == str(submission.id),
        AuditLog.action == "submission.approved",
    ).order_by(AuditLog.timestamp.desc()).first()

    audit_reference = approval_audit.event_id if approval_audit else None

    return {"success": True, "data": {
        "request_number": submission.request_number,
        "form_name": form.name if form else "Unknown",
        "form_code": form.form_code if form else "",
        "form_print_scale": form.print_scale if form else 0.94,
        "submitted_by": submitter.full_name if submitter else "Unknown",
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "approved_at": submission.approved_at.isoformat() if submission.approved_at else None,
        "status": "approved",
        "version_number": submission.version_number,
        "field_data": field_data,
        "approval_chain": approval_chain,
        "audit_reference": audit_reference,
        "printed_at": datetime.now(timezone.utc).isoformat(),
    }}
