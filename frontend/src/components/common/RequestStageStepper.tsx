import { Box, Typography } from '@mui/material';
import Check from '@mui/icons-material/Check';
import type { SubmissionStatus } from '../../types';
import { buildLifecycleSteps } from '../../utils/requestLifecycle';

const COMPLETED_COLOR = '#2e7d32';
const ACTIVE_COLOR = '#ed6c02';
const INACTIVE_FILL = '#e0e0e0';
const INACTIVE_BORDER = '#9e9e9e';

function getHelperText(status: SubmissionStatus) {
  if (status === 'needs_correction') {
    return 'Returned to the submitter for correction before the workflow can continue.';
  }

  if (status === 'rejected') {
    return 'This request was rejected and the workflow is now closed.';
  }

  return null;
}

interface RequestStageStepperProps {
  status: SubmissionStatus;
  hasAssignee?: boolean;
}

export default function RequestStageStepper({ status, hasAssignee = false }: RequestStageStepperProps) {
  const steps = buildLifecycleSteps(status, hasAssignee);
  const helperText = getHelperText(status);

  return (
    <Box sx={{ mt: 1.25 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          alignItems: 'start',
          gap: 0,
        }}
        >
        {steps.map((label, index) => {
          const isCompleted = label.state === 'completed';
          const isActive = label.state === 'active';
          const isFuture = label.state === 'upcoming';
          const circleColor = isCompleted ? COMPLETED_COLOR : isActive ? ACTIVE_COLOR : INACTIVE_FILL;
          const borderColor = isCompleted ? COMPLETED_COLOR : isActive ? ACTIVE_COLOR : INACTIVE_BORDER;
          const textColor = isFuture ? 'text.secondary' : 'text.primary';

          return (
            <Box key={label.key} sx={{ position: 'relative', px: 1 }}>
              {index < steps.length - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 10,
                    left: 'calc(50% + 12px)',
                    right: 'calc(-50% + 12px)',
                    height: 2,
                    bgcolor: isCompleted ? COMPLETED_COLOR : 'divider',
                    zIndex: 0,
                  }}
                />
              )}
              <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: circleColor,
                    color: isCompleted || isActive ? 'common.white' : 'text.secondary',
                    border: '1px solid',
                    borderColor,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {isCompleted ? <Check sx={{ fontSize: 15 }} /> : index + 1}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.75,
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    lineHeight: 1.15,
                    fontWeight: isFuture ? 500 : 700,
                    color: textColor,
                  }}
                >
                  {label.label}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {helperText && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
