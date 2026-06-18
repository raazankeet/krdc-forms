import type { SubmissionStatus, WorkflowActionType } from '../types';

export interface LifecycleStepView {
  key: string;
  label: string;
  state: 'completed' | 'active' | 'upcoming';
}

export interface WorkflowHistoryView {
  actionLabel: string;
  fromLabel: string;
  toLabel: string;
}

export function getDerivedSubmissionLabel(status: SubmissionStatus, hasAssignee: boolean): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return hasAssignee ? 'Under Review' : 'Submitted';
    case 'under_review':
      return hasAssignee ? 'Approval In Progress' : 'Under Approval';
    case 'approved':
      return 'Approved';
    case 'needs_correction':
      return 'Needs Correction';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Draft';
  }
}

export function buildLifecycleSteps(status: SubmissionStatus, hasAssignee: boolean): LifecycleStepView[] {
  if (status === 'approved') {
    return [
      { key: 'draft', label: 'Draft', state: 'completed' },
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Reviewed', state: 'completed' },
      { key: 'approval', label: 'Approval Completed', state: 'completed' },
      { key: 'approved', label: 'Approved', state: 'completed' },
    ];
  }

  if (status === 'draft') {
    return [
      { key: 'draft', label: 'Draft', state: 'active' },
      { key: 'submitted', label: 'Submitted', state: 'upcoming' },
      { key: 'review', label: 'Under Review', state: 'upcoming' },
      { key: 'approval', label: 'Under Approval', state: 'upcoming' },
      { key: 'approved', label: 'Approved', state: 'upcoming' },
    ];
  }

  if (status === 'submitted' && !hasAssignee) {
    return [
      { key: 'draft', label: 'Draft', state: 'completed' },
      { key: 'submitted', label: 'Submitted', state: 'active' },
      { key: 'review', label: 'Under Review', state: 'upcoming' },
      { key: 'approval', label: 'Under Approval', state: 'upcoming' },
      { key: 'approved', label: 'Approved', state: 'upcoming' },
    ];
  }

  if (status === 'submitted' && hasAssignee) {
    return [
      { key: 'draft', label: 'Draft', state: 'completed' },
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review In Progress', state: 'active' },
      { key: 'approval', label: 'Under Approval', state: 'upcoming' },
      { key: 'approved', label: 'Approved', state: 'upcoming' },
    ];
  }

  if (status === 'under_review' && !hasAssignee) {
    return [
      { key: 'draft', label: 'Draft', state: 'completed' },
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Reviewed', state: 'completed' },
      { key: 'approval', label: 'Sent To Approval', state: 'active' },
      { key: 'approved', label: 'Approved', state: 'upcoming' },
    ];
  }

  if (status === 'under_review' && hasAssignee) {
    return [
      { key: 'draft', label: 'Draft', state: 'completed' },
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Reviewed', state: 'completed' },
      { key: 'approval', label: 'Approval In Progress', state: 'active' },
      { key: 'approved', label: 'Approved', state: 'upcoming' },
    ];
  }

  return [
    { key: 'draft', label: 'Draft', state: 'completed' },
    { key: 'submitted', label: 'Needs Correction', state: 'active' },
    { key: 'review', label: 'Review Again', state: 'upcoming' },
    { key: 'approval', label: 'Approval Pending', state: 'upcoming' },
    { key: 'approved', label: 'Approved', state: 'upcoming' },
  ];
}

function getBaseStatusLabel(status?: SubmissionStatus | null): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Approval';
    case 'approved':
      return 'Approved';
    case 'needs_correction':
      return 'Needs Correction';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Unknown';
  }
}

export function getWorkflowHistoryView(
  action?: WorkflowActionType | string | null,
  fromStatus?: SubmissionStatus | null,
  toStatus?: SubmissionStatus | null,
): WorkflowHistoryView {
  if (action === 'submit') {
    return {
      actionLabel: 'Submitted',
      fromLabel: getBaseStatusLabel(fromStatus),
      toLabel: 'Submitted',
    };
  }

  if (action === 'resubmit') {
    return {
      actionLabel: 'Resubmitted',
      fromLabel: getBaseStatusLabel(fromStatus),
      toLabel: 'Submitted',
    };
  }

  if (action === 'start_review') {
    if (fromStatus === 'submitted') {
      return {
        actionLabel: 'Review Started',
        fromLabel: 'Submitted',
        toLabel: 'Under Review',
      };
    }

    if (fromStatus === 'under_review') {
      return {
        actionLabel: 'Approval Started',
        fromLabel: 'Sent To Approval',
        toLabel: 'Under Approval',
      };
    }
  }

  if (action === 'approve') {
    if (fromStatus === 'submitted') {
      return {
        actionLabel: 'Review Completed',
        fromLabel: 'Under Review',
        toLabel: 'Sent To Approval',
      };
    }

    if (fromStatus === 'under_review') {
      return {
        actionLabel: 'Approved',
        fromLabel: 'Under Approval',
        toLabel: 'Approved',
      };
    }
  }

  if (action === 'request_changes') {
    return {
      actionLabel: 'Changes Requested',
      fromLabel: fromStatus === 'submitted' ? 'Under Review' : fromStatus === 'under_review' ? 'Under Approval' : getBaseStatusLabel(fromStatus),
      toLabel: 'Needs Correction',
    };
  }

  if (action === 'reject') {
    return {
      actionLabel: 'Rejected',
      fromLabel: fromStatus === 'under_review' ? 'Under Approval' : getBaseStatusLabel(fromStatus),
      toLabel: 'Needs Correction',
    };
  }

  return {
    actionLabel: 'Updated',
    fromLabel: getBaseStatusLabel(fromStatus),
    toLabel: getBaseStatusLabel(toStatus),
  };
}
