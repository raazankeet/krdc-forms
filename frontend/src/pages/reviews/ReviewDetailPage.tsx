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
import { formatDistanceToNow } from 'date-fns';
import { useSnackbar } from 'notistack';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getFormComponent } from '../../forms/registry';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
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

  const handleWorkflowAction = async (action: string) => {
    if ((action === 'reject' || action === 'request_changes') && !commentText.trim()) {
      enqueueSnackbar('A comment is required for this action.', { variant: 'warning' });
      return;
    }

    setActionLoading(action);
    try {
      await apiService.post(`/api/v1/submissions/${id}/workflow/${action}`, {
        comment: commentText || undefined,
      });

      enqueueSnackbar(
        action === 'start-review'
          ? 'Review started.'
          : action === 'approve'
            ? 'Submission approved.'
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
  const isReviewer = roleNames.includes('Reviewer') || isApprover || roleNames.includes('Administrator');
  const assigneeId = typeof submission.current_assignee === 'number'
    ? submission.current_assignee
    : submission.current_assignee?.id;
  const assigneeName = typeof submission.current_assignee === 'number'
    ? 'another reviewer'
    : submission.current_assignee?.full_name;
  const isAssignedToCurrentUser = !!user && assigneeId === user.id;

  const canStartReview = isReviewer && submission.status === 'submitted';
  const canRequestChanges = isReviewer && submission.status === 'under_review' && isAssignedToCurrentUser;
  const canApproveOrReject = isReviewer && submission.status === 'under_review' && isAssignedToCurrentUser;
  const showActionPanel = canStartReview || canRequestChanges || canApproveOrReject;
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

      <Card sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StatusChip status={submission.status} size="medium" />
            </Box>
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
                {submission.submitted_at
                  ? formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })
                  : 'Not submitted yet'}
              </Typography>
            </Box>
          </Box>
        </Stack>
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
                {submission.workflow_actions.map((action: WorkflowAction) => (
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
                      {action.user?.full_name || 'System'} - {action.action.replace('_', ' ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                    </Typography>
                    {action.comment && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {`"${action.comment}"`}
                      </Typography>
                    )}
                  </Box>
                ))}
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
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
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
          This request is currently checked out by {assigneeName}.
        </Alert>
      )}

      {showActionPanel && (
        <Card sx={{ mt: 3, p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Review Actions
          </Typography>
          {canStartReview && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Start the review to check out this request and continue the decision workflow.
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder={canStartReview
              ? 'Optional note for starting this review...'
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
                onClick={() => handleWorkflowAction('start-review')}
              >
                Start Review
              </Button>
            )}
            {canApproveOrReject && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={actionLoading === 'approve' ? <CircularProgress size={16} /> : <CheckCircle />}
                  disabled={!!actionLoading}
                  onClick={() => handleWorkflowAction('approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={actionLoading === 'reject' ? <CircularProgress size={16} /> : <Cancel />}
                  disabled={!!actionLoading}
                  onClick={() => setConfirmAction('reject')}
                >
                  Reject
                </Button>
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
        title={confirmAction === 'reject' ? 'Send Back to Submitter' : 'Request Changes'}
        message={confirmAction === 'reject'
          ? 'This will return the request to the submitter for correction. A comment is required.'
          : 'This will send the request back to the submitter with your requested changes.'}
        confirmLabel={confirmAction === 'reject' ? 'Send Back' : 'Request Changes'}
        confirmColor={confirmAction === 'reject' ? 'error' : 'warning'}
        loading={!!actionLoading}
        onConfirm={() => handleWorkflowAction(confirmAction!)}
        onCancel={() => setConfirmAction(null)}
      />
    </Box>
  );
}
