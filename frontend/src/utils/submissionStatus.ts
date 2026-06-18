import type { SubmissionStatus, WorkflowActionType } from '../types';

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_correction: 'Needs Correction',
};

const WORKFLOW_ACTION_LABELS: Record<string, string> = {
  submit: 'Submitted',
  start_review: 'Started Review',
  approve: 'Approved',
  reject: 'Rejected',
  request_changes: 'Requested Changes',
  resubmit: 'Resubmitted',
};

export function getStatusLabel(status?: SubmissionStatus | null): string {
  if (!status) {
    return 'Unknown';
  }

  return STATUS_LABELS[status] || status;
}

export function getWorkflowActionLabel(action?: WorkflowActionType | string | null): string {
  if (!action) {
    return 'Updated';
  }

  return WORKFLOW_ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
