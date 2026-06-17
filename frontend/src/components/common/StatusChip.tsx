import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  Schedule, Send, RemoveRedEye, CheckCircle,
  Cancel, Loop, Drafts,
} from '@mui/icons-material';
import type { SubmissionStatus } from '../../types';

const statusConfig: Record<SubmissionStatus, {
  label: string;
  color: ChipProps['color'];
  icon: React.ReactElement;
}> = {
  draft: { label: 'Draft', color: 'default', icon: <Drafts /> },
  submitted: { label: 'Submitted', color: 'secondary', icon: <Send /> },
  under_review: { label: 'Under Review', color: 'info', icon: <RemoveRedEye /> },
  approved: { label: 'Approved', color: 'success', icon: <CheckCircle /> },
  rejected: { label: 'Rejected', color: 'error', icon: <Cancel /> },
  needs_correction: { label: 'Needs Correction', color: 'warning', icon: <Loop /> },
};

interface StatusChipProps {
  status: SubmissionStatus;
  size?: 'small' | 'medium';
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size={size}
      variant="filled"
    />
  );
}
