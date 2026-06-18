import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  Send, RemoveRedEye, CheckCircle,
  Cancel, Loop, Drafts,
} from '@mui/icons-material';
import type { SubmissionStatus } from '../../types';
import { getStatusLabel } from '../../utils/submissionStatus';

const statusConfig: Record<SubmissionStatus, {
  color: ChipProps['color'];
  icon: React.ReactElement;
}> = {
  draft: { color: 'default', icon: <Drafts /> },
  submitted: { color: 'secondary', icon: <Send /> },
  under_review: { color: 'info', icon: <RemoveRedEye /> },
  approved: { color: 'success', icon: <CheckCircle /> },
  rejected: { color: 'error', icon: <Cancel /> },
  needs_correction: { color: 'warning', icon: <Loop /> },
};

interface StatusChipProps {
  status: SubmissionStatus;
  size?: 'small' | 'medium';
  labelOverride?: string;
}

export default function StatusChip({ status, size = 'small', labelOverride }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <Chip
      icon={config.icon}
      label={labelOverride || getStatusLabel(status)}
      color={config.color}
      size={size}
      variant="filled"
    />
  );
}
