from datetime import datetime
from sqlalchemy.orm import Session
from app.models.form import RequestNumbering


def build_draft_request_number(submission_id: int) -> str:
    return f"DRAFT-{submission_id:06d}"


def is_draft_request_number(request_number: str | None) -> bool:
    return bool(request_number and request_number.startswith("DRAFT-"))


def generate_request_number(db: Session, form_id: int, prefix: str, year_reset: bool) -> str:
    """Atomically generate the next request number for a form."""
    numbering = db.query(RequestNumbering).filter(RequestNumbering.form_id == form_id).with_for_update().first()

    if not numbering:
        numbering = RequestNumbering(
            form_id=form_id,
            prefix=prefix,
            year_reset=year_reset,
            current_sequence=0,
            current_year=datetime.now().year,
        )
        db.add(numbering)
        db.flush()

    current_year = datetime.now().year

    if year_reset and numbering.current_year != current_year:
        numbering.current_sequence = 0
        numbering.current_year = current_year

    numbering.current_sequence += 1
    db.flush()

    if year_reset:
        return f"{prefix}-{current_year}-{numbering.current_sequence:06d}"
    else:
        return f"{prefix}-{numbering.current_sequence:06d}"
