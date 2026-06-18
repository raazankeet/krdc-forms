import { Alert, Box, Card, Chip, Stack, Typography } from '@mui/material';
import StatusChip from './StatusChip';
import type { SubmissionStatus } from '../../types';

type GuideContext = 'submitter' | 'reviewer' | 'manager';

interface LifecycleStep {
  status: SubmissionStatus;
  title: string;
  description: string;
}

const lifecycleStepsByContext: Record<GuideContext, LifecycleStep[]> = {
  submitter: [
    {
      status: 'draft',
      title: 'Draft',
      description: 'Your request is still in preparation. You can save, edit, and validate it before sending it forward.',
    },
    {
      status: 'submitted',
      title: 'Submitted',
      description: 'Your request has been sent to the reviewer stage. It is waiting for the assigned reviewer to pick it up.',
    },
    {
      status: 'under_review',
      title: 'Under Approval',
      description: 'The reviewer has completed the first check and the request is now with the approver stage for the final decision.',
    },
    {
      status: 'needs_correction',
      title: 'Needs Correction',
      description: 'The request has been returned to you. Open it, read the comments, make the requested changes, and resubmit it.',
    },
    {
      status: 'approved',
      title: 'Approved',
      description: 'Your request has been accepted and the approved version is now the final locked record.',
    },
  ],
  reviewer: [
    {
      status: 'submitted',
      title: 'Submitted',
      description: 'The request is waiting in the reviewer queue. The assigned reviewer should start review here.',
    },
    {
      status: 'under_review',
      title: 'Under Approval',
      description: 'The reviewer has already completed the first stage. The assigned approver should now start approval or return it with comments.',
    },
    {
      status: 'needs_correction',
      title: 'Needs Correction',
      description: 'The request has been sent back to the submitter with feedback. It should return later as a resubmission.',
    },
    {
      status: 'approved',
      title: 'Approved',
      description: 'The request has completed review successfully and no further action is needed from the review side.',
    },
  ],
  manager: [
    {
      status: 'draft',
      title: 'Draft',
      description: 'The request exists but has not entered the review workflow yet.',
    },
    {
      status: 'submitted',
      title: 'Submitted',
      description: 'The request has entered the reviewer queue and is waiting for the assigned reviewer.',
    },
    {
      status: 'under_review',
      title: 'Under Approval',
      description: 'The reviewer stage is complete and the request is now waiting for approver action.',
    },
    {
      status: 'needs_correction',
      title: 'Needs Correction',
      description: 'The request has been returned to the submitter and is expected to come back as a corrected resubmission.',
    },
    {
      status: 'approved',
      title: 'Approved',
      description: 'The request has completed the lifecycle successfully and is retained as the approved record.',
    },
  ],
};

const guideIntro: Record<GuideContext, string> = {
  submitter: 'This guide focuses on what the submitter should expect and what action to take at each stage.',
  reviewer: 'This guide focuses on the review-side workflow, including when to start review and when to return a request.',
  manager: 'This guide summarizes the full end-to-end workflow across both submitter and reviewer responsibilities.',
};

const guideHighlights: Record<GuideContext, string[]> = {
  submitter: [
    'Drafts are editable only by the submitter.',
    'Returned requests should always be reopened from the submitter side, corrected, and resubmitted.',
    'Comments and review history explain why a request came back.',
  ],
  reviewer: [
    'The operational chain is researcher to reviewer to approver.',
    'Start review before trying to complete your stage or return a request.',
    'Use comments when returning a request so the submitter knows exactly what to fix.',
    'Reviewer approval forwards the request to the approver. Approver approval completes it.',
  ],
  manager: [
    'The queue moves from submitter preparation to reviewer action, then to approver action, then to final approval or return for correction.',
    'Returned requests should come back through resubmission, not through a brand-new request.',
    'Status, comments, and workflow history should tell the same story everywhere in the app.',
  ],
};

interface RequestLifecycleGuideProps {
  context?: GuideContext;
}

export default function RequestLifecycleGuide({ context = 'manager' }: RequestLifecycleGuideProps) {
  const lifecycleSteps = lifecycleStepsByContext[context];

  return (
    <Card sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Request Lifecycle Guide
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {guideIntro[context]}
      </Typography>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {guideHighlights[context].map((item) => (
          <Chip key={item} label={item} variant="outlined" size="small" />
        ))}
      </Stack>

      <Stack spacing={1.25}>
        {lifecycleSteps.map((step) => (
          <Box
            key={step.status}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <StatusChip status={step.status} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {step.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      <Alert severity="info" sx={{ mt: 2 }}>
        Rejected items are treated as returned requests in this workflow. They should come back to the submitter with comments, then move forward again through resubmission.
      </Alert>
    </Card>
  );
}
