from app.models.submission import SubmissionStatus, WorkflowActionType

# Valid transitions: from_status -> {action: to_status}
VALID_TRANSITIONS = {
    SubmissionStatus.DRAFT: {
        WorkflowActionType.SUBMIT: SubmissionStatus.SUBMITTED,
    },
    SubmissionStatus.SUBMITTED: {
        WorkflowActionType.APPROVE: SubmissionStatus.UNDER_REVIEW,
        WorkflowActionType.REQUEST_CHANGES: SubmissionStatus.NEEDS_CORRECTION,
        WorkflowActionType.REJECT: SubmissionStatus.NEEDS_CORRECTION,
    },
    SubmissionStatus.UNDER_REVIEW: {
        WorkflowActionType.APPROVE: SubmissionStatus.APPROVED,
        WorkflowActionType.REJECT: SubmissionStatus.NEEDS_CORRECTION,
        WorkflowActionType.REQUEST_CHANGES: SubmissionStatus.NEEDS_CORRECTION,
    },
    SubmissionStatus.NEEDS_CORRECTION: {
        WorkflowActionType.RESUBMIT: SubmissionStatus.SUBMITTED,
    },
    SubmissionStatus.REJECTED: {
        WorkflowActionType.RESUBMIT: SubmissionStatus.SUBMITTED,
    },
}


def get_allowed_actions(status: SubmissionStatus) -> list[WorkflowActionType]:
    """Get the list of allowed workflow actions for a given status."""
    transitions = VALID_TRANSITIONS.get(status, {})
    return list(transitions.keys())


def validate_transition(
    from_status: SubmissionStatus,
    action: WorkflowActionType,
) -> SubmissionStatus:
    """
    Validate and execute a workflow transition.
    Returns the new status if valid, raises ValueError if invalid.
    """
    transitions = VALID_TRANSITIONS.get(from_status)
    if not transitions:
        raise ValueError(f"No transitions allowed from status '{from_status.value}'")

    new_status = transitions.get(action)
    if not new_status:
        allowed = ", ".join([a.value for a in transitions.keys()])
        raise ValueError(
            f"Invalid action '{action.value}' for status '{from_status.value}'. "
            f"Allowed actions: {allowed}"
        )

    return new_status
