import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  Typography,
  Tabs,
  Tab,
  Button,
  Chip,
  Alert,
  Paper,
  Avatar,
  Stack,
} from '@mui/material';
import {
  Description,
  History,
  Comment as CommentIcon,
  CompareArrows,
  Print,
  Edit,
  Delete,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { getFormComponent } from '../../forms/registry';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import IssueDialog from '../../components/common/IssueDialog';
import RequestStageStepper from '../../components/common/RequestStageStepper';
import { formatLocalDateTimeWithRelative } from '../../utils/dateTime';
import { getDerivedSubmissionLabel, getWorkflowHistoryView } from '../../utils/requestLifecycle';
import type { Submission, SubmissionComment, SubmissionVersion, ApiResponse } from '../../types';

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  if (value !== index) return null;
  return <Box sx={{ py: 2 }}>{children}</Box>;
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: 'Submission Issue',
    message: '',
  });

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

  const handleDeleteDraft = async () => {
    setDeleteLoading(true);
    try {
      await apiService.delete(`/api/v1/submissions/${id}`);
      navigate('/submissions');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setIssueDialog({
        open: true,
        title: 'Submission Issue',
        message: axiosErr?.response?.data?.error?.message || 'Failed to delete draft.',
      });
    } finally {
      setDeleteLoading(false);
      setConfirmAction(null);
    }
  };

  const formComponent = submission?.form?.form_code ? getFormComponent(submission.form.form_code) : undefined;
  const FormView = formComponent?.FormView;
  const formData = submission?.current_version?.data || {};
  const hasAssignee = !!submission?.current_assignee;

  if (loading) {
    return (
      <Box>
        <PageHeader title="Submission" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Loading...' }]} />
        <LoadingSkeleton variant="detail" />
      </Box>
    );
  }

  if (error || !submission) {
    return (
      <Box>
        <PageHeader title="Error" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Detail' }]} />
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Submission not found.'}</Alert>
        <Button onClick={() => navigate('/submissions')}>Back to Submissions</Button>
      </Box>
    );
  }

  const canEdit = submission.status === 'draft' || submission.status === 'needs_correction';
  const canPrint = submission.status === 'approved';
  const originPath = location.state?.originPath === '/requests' ? '/requests' : '/submissions';
  const originLabel = location.state?.originLabel === 'Request Management' ? 'Request Management' : 'Submissions';

  return (
    <Box>
      <PageHeader
        title={submission.request_number}
        subtitle={submission.form?.name || 'Submission'}
        breadcrumbs={[
          { label: originLabel, href: originPath },
          { label: submission.request_number },
        ]}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canPrint && (
              <Button
                variant="outlined"
                startIcon={<Print />}
                onClick={() => navigate(`/print/${submission.id}`)}
              >
                Print
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => navigate(`/submissions/${submission.id}/edit`)}
              >
                {submission.status === 'draft' ? 'Edit Draft' : 'Resume Corrections'}
              </Button>
            )}
            {submission.status === 'draft' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setConfirmAction('delete_draft')}
              >
                Delete Draft
              </Button>
            )}
          </Box>
        }
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
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, verticalAlign: 'middle' }}>
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
              <Typography variant="caption" color="text.secondary">
                v{submission.version_number}
              </Typography>
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
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<Description />} iconPosition="start" label="Form Data" />
          <Tab icon={<History />} iconPosition="start" label="History" />
          <Tab icon={<CommentIcon />} iconPosition="start" label="Comments" />
          <Tab icon={<CompareArrows />} iconPosition="start" label="Versions" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Box sx={{ px: 3, pb: 3 }}>
            {FormView ? (
              <FormView data={formData} readOnly />
            ) : (
              <EmptyState title="Form data unavailable" description="This form type is not registered." />
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ px: 3, pb: 3 }}>
            {submission.workflow_actions && submission.workflow_actions.length > 0 ? (
              <Stack spacing={2}>
                {submission.workflow_actions.map((action) => {
                  const historyView = getWorkflowHistoryView(action.action, action.from_status, action.to_status);

                  return (
                    <Box
                      key={action.id}
                      sx={{
                        display: 'flex',
                        gap: 2,
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
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={historyView.actionLabel}
                            size="small"
                            color={
                              action.action === 'approve'
                                ? 'success'
                                : action.action === 'reject'
                                  ? 'error'
                                  : action.action === 'request_changes'
                                    ? 'warning'
                                    : 'primary'
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatLocalDateTimeWithRelative(action.created_at)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {action.user?.full_name || 'System'} updated this request.
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
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
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <EmptyState title="No history" description="No workflow actions have been recorded." />
            )}
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
                      alignSelf: comment.comment_type === 'correction_request' ? 'flex-end' : 'flex-start',
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
            ) : (
              <EmptyState title="No comments" description="No comments have been added to this submission." />
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <Box sx={{ px: 3, pb: 3 }}>
            {submission.versions && submission.versions.length > 0 ? (
              <Stack spacing={2}>
                {submission.versions.map((version: SubmissionVersion) => (
                  <Card key={version.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2">
                          Version {version.version_number}
                          {version.is_approved_snapshot && (
                            <Chip label="Approved" size="small" color="success" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatLocalDateTimeWithRelative(version.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Stack>
            ) : (
              <EmptyState title="No versions" description="No version history available." />
            )}
          </Box>
        </TabPanel>
      </Paper>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction === 'delete_draft' ? 'Delete Draft' : 'Confirm Action'}
        message={
          confirmAction === 'delete_draft'
            ? 'Delete this draft? This will remove the unfinished submission and its temporary draft identifier.'
            : 'Are you sure?'
        }
        confirmLabel={confirmAction === 'delete_draft' ? 'Delete Draft' : 'Confirm'}
        confirmColor={confirmAction === 'delete_draft' ? 'error' : 'primary'}
        loading={confirmAction === 'delete_draft' ? deleteLoading : false}
        onConfirm={() => (confirmAction === 'delete_draft' ? handleDeleteDraft() : setConfirmAction(null))}
        onCancel={() => setConfirmAction(null)}
      />

      <IssueDialog
        open={issueDialog.open}
        title={issueDialog.title}
        message={issueDialog.message}
        onClose={() => setIssueDialog((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
