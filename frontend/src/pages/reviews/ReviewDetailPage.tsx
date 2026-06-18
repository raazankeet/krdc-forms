import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  Typography,
  Tabs,
  Tab,
  Button,
  Alert,
  Paper,
  Stack,
  TextField,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Description,
  History,
  Comment as CommentIcon,
  CheckCircle,
  Cancel,
  Loop,
  PlayArrow,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getFormComponent } from '../../forms/registry';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RequestStageStepper from '../../components/common/RequestStageStepper';
import { formatLocalDateTimeWithRelative } from '../../utils/dateTime';
import { getDerivedSubmissionLabel, getWorkflowHistoryView } from '../../utils/requestLifecycle';
import type { Submission, SubmissionComment, WorkflowAction, ApiResponse } from '../../types';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  if (value !== index) return null;
  return <Box sx={{ py: 2 }}>{children}</Box>;
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const openedFromRequests = location.state?.originPath === '/requests';
  const parentPath = openedFromRequests ? '/requests' : '/reviews';
  const parentLabel = openedFromRequests ? 'Request Management' : 'Review Queue';

  const fetchSubmission = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<ApiResponse<Submission>>(`/api/v1/submissions/${id}`);
      setSubmission(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load submission.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const getWorkflowEndpoint = useCallback((action: string) => {
    switch (action) {
      case 'start-review':
        return 'start-review';
      case 'request_changes':
        return 'request-changes';
      default:
        return action;
    }
  }, []);

  const handleWorkflowAction = async (action: string) => {
    if ((action === 'reject' || action === 'request_changes') && !commentText.trim()) {
      enqueueSnackbar('A comment is required for this action.', { variant: 'warning' });
      return;
    }

    setActionLoading(action);
    try {
      await apiService.post(`/api/v1/submissions/${id}/workflow/${getWorkflowEndpoint(action)}`, {
        comment: commentText || undefined,
      });

      enqueueSnackbar(
        action === 'start-review'
          ? 'Review started.'
          : action === 'approve'
            ? submission?.status === 'submitted'
              ? 'Review completed and forwarded to the approver.'
              : 'Submission approved.'
            : action === 'reject'
              ? 'Submission sent back to the submitter.'
              : 'Changes requested.',
        { variant: action === 'approve' ? 'success' : action === 'reject' ? 'warning' : 'info' },
      );

      setCommentText('');
      setConfirmAction(null);

      if (action === 'start-review') {
        await fetchSubmission();
        return;
      }

      navigate(parentPath);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      enqueueSnackbar(axiosErr?.response?.data?.error?.message || `Failed to ${action}.`, { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const formComponent = submission?.form?.form_code ? getFormComponent(submission.form.form_code) : undefined;
  const FormView = formComponent?.FormView;
  const formData = submission?.current_version?.data || {};

  if (loading) {
    return (
      <Box>
        <PageHeader title="Review" breadcrumbs={[{ label: 'Review Queue', href: '/reviews' }, { label: 'Loading...' }]} />
        <LoadingSkeleton variant="detail" />
      </Box>
    );
  }

  if (error || !submission) {
    return (
      <Box>
        <PageHeader title="Error" breadcrumbs={[{ label: 'Review Queue', href: '/reviews' }, { label: 'Detail' }]} />
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Submission not found.'}</Alert>
        <Button onClick={() => navigate('/reviews')}>Back to Queue</Button>
      </Box>
    );
  }

  const roleNames = user?.roles.map((role) => role.name) || [];
  const isApprover = roleNames.includes('Approver');
  const isReviewer = roleNames.includes('Reviewer');
  const assigneeId = typeof submission.current_assignee === 'number'
    ? submission.current_assignee
    : submission.current_assignee?.id;
  const assigneeName = typeof submission.current_assignee === 'number'
    ? 'another reviewer'
    : submission.current_assignee?.full_name;
  const isAssignedToCurrentUser = !!user && assigneeId === user.id;
  const hasAssignee = !!submission.current_assignee;

  const isReviewerStage = submission.status === 'submitted';
  const isApproverStage = submission.status === 'under_review';
  const canStartReview =
    (isReviewer && isReviewerStage && !submission.current_assignee)
    || (isApprover && isApproverStage && !submission.current_assignee);
  const canRequestChanges =
    ((isReviewer && isReviewerStage) || (isApprover && isApproverStage))
    && isAssignedToCurrentUser;
  const canApproveOrReject =
    ((isReviewer && isReviewerStage) || (isApprover && isApproverStage))
    && isAssignedToCurrentUser;
  const showActionPanel = canStartReview || canRequestChanges || canApproveOrReject;

  const confirmDialogConfig = (() => {
    switch (confirmAction) {
      case 'start-review':
        return {
          title: isReviewerStage ? 'Start Review' : 'Start Approval',
          message: isReviewerStage
            ? 'This will check out the request to you and move it into the active review stage.'
            : 'This will check out the request to you and move it into the active approval stage.',
          confirmLabel: isReviewerStage ? 'Start Review' : 'Start Approval',
          confirmColor: 'primary' as const,
        };
      case 'approve':
        return {
          title: isReviewerStage ? 'Send To Approver' : 'Approve Request',
          message: isReviewerStage
            ? 'This will complete your review and forward the request to the approver queue.'
            : 'This will approve the request and complete the workflow.',
          confirmLabel: isReviewerStage ? 'Send To Approver' : 'Approve',
          confirmColor: isReviewerStage ? 'primary' as const : 'success' as const,
        };
      case 'reject':
        return {
          title: 'Send Back to Submitter',
          message: 'This will return the request to the submitter for correction. A comment is required.',
          confirmLabel: 'Send Back',
          confirmColor: 'error' as const,
        };
      case 'request_changes':
        return {
          title: 'Request Changes',
          message: 'This will send the request back to the submitter with your requested changes.',
          confirmLabel: 'Request Changes',
          confirmColor: 'warning' as const,
        };
      default:
        return null;
    }
  })();

  return (
    <Box>
      <PageHeader
        title={`Review: ${submission.request_number}`}
        subtitle={submission.form?.name || 'Submission'}
        breadcrumbs={[
          { label: parentLabel, href: parentPath },
          { label: submission.request_number },
        ]}
      />

      <Card sx={{ p: { xs: 2, sm: 2.25 }, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 1.25,
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
              <Typography variant="body2" color="inherit">
                Submitted by
              </Typography>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem' }}>
                  {submission.user?.full_name?.[0] || '?'}
                </Avatar>
                <Typography component="span" variant="body2" color="inherit">
                  {submission.user?.full_name || 'Unknown'}
                </Typography>
              </Box>
              <Typography variant="body2" color="inherit">
                {' • '}
              </Typography>
              <Typography variant="body2" color="inherit">
                {submission.submitted_at ? formatLocalDateTimeWithRelative(submission.submitted_at) : 'Not submitted yet'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <StatusChip
                status={submission.status}
                size="medium"
                labelOverride={getDerivedSubmissionLabel(submission.status, hasAssignee)}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 1 }}>
            <RequestStageStepper status={submission.status} hasAssignee={hasAssignee} />
          </Box>
        </Box>
      </Card>

      <Paper sx={{ borderRadius: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab icon={<Description />} iconPosition="start" label="Form Data" />
          <Tab icon={<History />} iconPosition="start" label="History" />
          <Tab icon={<CommentIcon />} iconPosition="start" label="Comments" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Box sx={{ px: 3, pb: 3 }}>
            {FormView ? <FormView data={formData} readOnly /> : <EmptyState title="Form data unavailable" />}
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ px: 3, pb: 3 }}>
            {submission.workflow_actions && submission.workflow_actions.length > 0 ? (
              <Stack spacing={2}>
                {submission.workflow_actions.map((action: WorkflowAction) => {
                  const historyView = getWorkflowHistoryView(action.action, action.from_status, action.to_status);

                  return (
                    <Box
                      key={action.id}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        borderLeft: 4,
                        borderColor:
                          action.action === 'approve'
                            ? 'success.main'
                            : action.action === 'reject'
                              ? 'error.main'
                              : action.action === 'request_changes'
                                ? 'warning.main'
                                : 'primary.main',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {action.user?.full_name || 'System'} - {historyView.actionLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatLocalDateTimeWithRelative(action.created_at)}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap" alignItems="center">
                        <Chip label={historyView.fromLabel} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          to
                        </Typography>
                        <Chip label={historyView.toLabel} size="small" variant="outlined" />
                      </Stack>
                      {action.comment && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                          {`"${action.comment}"`}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            ) : <EmptyState title="No history" />}
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Box sx={{ px: 3, pb: 3 }}>
            {submission.comments && submission.comments.length > 0 ? (
              <Stack spacing={2}>
                {submission.comments.map((comment: SubmissionComment) => (
                  <Box
                    key={comment.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: comment.comment_type === 'correction_request' ? 'warning.light' : 'action.hover',
                      maxWidth: '80%',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                        {comment.user?.full_name?.[0] || '?'}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {comment.user?.full_name || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatLocalDateTimeWithRelative(comment.created_at)}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{comment.comment}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : <EmptyState title="No comments" />}
          </Box>
        </TabPanel>
      </Paper>

      {submission.status === 'under_review' && !isAssignedToCurrentUser && assigneeName && (
        <Alert severity="info" sx={{ mt: 3 }}>
          This approval is currently checked out by {assigneeName}.
        </Alert>
      )}

      {showActionPanel && (
        <Card sx={{ mt: 3, p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {isReviewerStage ? 'Reviewer Actions' : 'Approver Actions'}
          </Typography>
          {canStartReview && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {isReviewerStage
                ? 'Start review to check out this request, complete your review, and then forward it to the approver.'
                : 'Start approval to check out this request and complete the final decision.'}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder={canStartReview
              ? 'Optional note for starting this step...'
              : 'Add a comment. This is required for rejection and change requests.'}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            sx={{ mb: 2 }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canStartReview && (
              <Button
                variant="contained"
                startIcon={actionLoading === 'start-review' ? <CircularProgress size={16} /> : <PlayArrow />}
                disabled={!!actionLoading}
                onClick={() => setConfirmAction('start-review')}
              >
                {isReviewerStage ? 'Start Review' : 'Start Approval'}
              </Button>
            )}
            {canApproveOrReject && (
              <>
                <Button
                  variant="contained"
                  color={isReviewerStage ? 'primary' : 'success'}
                  startIcon={actionLoading === 'approve' ? <CircularProgress size={16} /> : <CheckCircle />}
                  disabled={!!actionLoading}
                  onClick={() => setConfirmAction('approve')}
                >
                  {isReviewerStage ? 'Send To Approver' : 'Approve'}
                </Button>
                {isApproverStage && (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={actionLoading === 'reject' ? <CircularProgress size={16} /> : <Cancel />}
                    disabled={!!actionLoading}
                    onClick={() => setConfirmAction('reject')}
                  >
                    Reject
                  </Button>
                )}
              </>
            )}
            {canRequestChanges && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={actionLoading === 'request_changes' ? <CircularProgress size={16} /> : <Loop />}
                disabled={!!actionLoading}
                onClick={() => setConfirmAction('request_changes')}
              >
                Request Changes
              </Button>
            )}
          </Stack>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmDialogConfig?.title || 'Confirm Action'}
        message={confirmDialogConfig?.message || 'Please confirm this action.'}
        confirmLabel={confirmDialogConfig?.confirmLabel || 'Confirm'}
        confirmColor={confirmDialogConfig?.confirmColor || 'primary'}
        loading={!!actionLoading}
        onConfirm={() => handleWorkflowAction(confirmAction!)}
        onCancel={() => setConfirmAction(null)}
      />
    </Box>
  );
}
