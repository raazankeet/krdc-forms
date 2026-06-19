import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  Send, Visibility, CheckCircle,
  Cancel, Sync, Drafts,
} from '@mui/icons-material';
import type { SubmissionStatus } from '../../types';
import { getStatusLabel } from '../../utils/submissionStatus';

const statusConfig: Record<SubmissionStatus, {
  bgcolor: string;
  icon: React.ReactElement;
}> = {
  draft: { bgcolor: '#9e9e9e', icon: <Drafts /> },
  submitted: { bgcolor: '#3b8775', icon: <Send /> },
  under_review: { bgcolor: '#3b82f6', icon: <Visibility /> },
  approved: { bgcolor: '#4a7c59', icon: <CheckCircle /> },
  rejected: { bgcolor: '#d32f2f', icon: <Cancel /> },
  needs_correction: { bgcolor: '#e27429', icon: <Sync /> },
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
      className="anim-scaleIn"
      icon={config.icon}
      label={labelOverride || getStatusLabel(status)}
      size={size}
      variant="filled"
      sx={{
        bgcolor: config.bgcolor,
        color: '#ffffff',
        fontWeight: 600,
        '& .MuiChip-icon': { color: '#ffffff' },
        ...(status === 'approved' && {
          animation: 'scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both, pulseGlow 2.5s ease-in-out 0.5s infinite',
        }),
      }}
    />
  );
}
