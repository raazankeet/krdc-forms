from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.form import FormAssignment

SUBMITTER_ROLE = "submitter"
REVIEWER_ROLE = "reviewer"
APPROVER_ROLE = "approver"
ASSIGNMENT_ROLES = {SUBMITTER_ROLE, REVIEWER_ROLE, APPROVER_ROLE}


def normalize_assignment_role(role: str | None) -> str:
    normalized = (role or SUBMITTER_ROLE).strip().lower()
    return normalized if normalized in ASSIGNMENT_ROLES else SUBMITTER_ROLE


def get_assignment_roles(db: Session, *, form_id: int, user_id: int) -> set[str]:
    assignments = (
        db.query(FormAssignment)
        .filter(
            FormAssignment.form_id == form_id,
            FormAssignment.user_id == user_id,
        )
        .all()
    )
    return {normalize_assignment_role(assignment.role) for assignment in assignments}


def has_assignment_role(db: Session, *, form_id: int, user_id: int, role: str) -> bool:
    normalized_role = normalize_assignment_role(role)
    return (
        db.query(FormAssignment)
        .filter(
            FormAssignment.form_id == form_id,
            FormAssignment.user_id == user_id,
            FormAssignment.role == normalized_role,
        )
        .first()
        is not None
    )


def get_assigned_user_ids(db: Session, *, form_id: int, role: str) -> list[int]:
    normalized_role = normalize_assignment_role(role)
    rows = (
        db.query(FormAssignment.user_id)
        .filter(
            FormAssignment.form_id == form_id,
            FormAssignment.role == normalized_role,
        )
        .all()
    )
    return [row[0] for row in rows]


def group_assignment_ids(
    *,
    submitters: Iterable[int] | None = None,
    reviewers: Iterable[int] | None = None,
    approvers: Iterable[int] | None = None,
) -> dict[str, list[int]]:
    return {
        SUBMITTER_ROLE: list(dict.fromkeys(submitters or [])),
        REVIEWER_ROLE: list(dict.fromkeys(reviewers or [])),
        APPROVER_ROLE: list(dict.fromkeys(approvers or [])),
    }
