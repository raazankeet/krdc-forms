import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, Alert, Tabs, Tab, Stack,
} from '@mui/material';
import {
  Add, Visibility, Edit, Print, Refresh, Delete,
} from '@mui/icons-material';
 
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import SearchBar from '../../components/common/SearchBar';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import RequestLifecycleGuide from '../../components/common/RequestLifecycleGuide';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatLocalDateTime, formatRelativeDateTime } from '../../utils/dateTime';
import { getDerivedSubmissionLabel } from '../../utils/requestLifecycle';
import type { Submission, PaginatedResponse } from '../../types';

const PAGE_SIZE = 10;

function getStatusSummary(status: Submission['status'], hasAssignee: boolean) {
  switch (status) {
    case 'draft':
      return {
        stage: 'Preparation',
        detail: 'This request is still with you. You can edit, validate, save, or delete the draft before submission.',
        nextAction: 'Complete the form and submit it for review.',
      };
    case 'submitted':
      return hasAssignee
        ? {
          stage: 'Under Review',
          detail: 'The reviewer has started working on this request and the review stage is currently in progress.',
          nextAction: 'No action is needed now. Wait for the reviewer to complete the review stage.',
        }
        : {
          stage: 'Queued For Reviewer',
          detail: 'The request has been submitted and is waiting for the assigned reviewer to start the first review stage.',
          nextAction: 'No action needed now. Wait for the reviewer to complete the review stage.',
        };
    case 'under_review':
      return hasAssignee
        ? {
          stage: 'Approval In Progress',
          detail: 'The approver has started working on this request and the final approval stage is in progress.',
          nextAction: 'Monitor comments and history. Editing stays locked while approval is in progress.',
        }
        : {
          stage: 'Queued For Approver',
          detail: 'The reviewer stage is complete. The request is now with the approver for the final decision.',
          nextAction: 'Monitor comments and history. Editing stays locked while approval is in progress.',
        };
    case 'needs_correction':
      return {
        stage: 'Returned To Submitter',
        detail: 'The review team sent this request back. Open it, read the feedback, make corrections, and resubmit it.',
        nextAction: 'Open the request in edit mode, apply the requested changes, and resubmit.',
      };
    case 'rejected':
      return {
        stage: 'Rejected',
        detail: 'The approver rejected this request and closed the workflow.',
        nextAction: 'No further action is available. Review the history and comments for the rejection reason.',
      };
    case 'approved':
      return {
        stage: 'Completed',
        detail: 'This request has been approved and is now the final locked record.',
        nextAction: 'You can view or print the approved record.',
      };
    default:
      return {
        stage: 'Unknown',
        detail: 'The current lifecycle state could not be determined.',
        nextAction: 'Open the request for more details.',
      };
  }
}

export default function SubmissionListPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'submissions' | 'guide'>('submissions');
  const [deletingSubmission, setDeletingSubmission] = useState<Submission | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = {
        page: page + 1,
        page_size: PAGE_SIZE,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/submissions', params);
      setSubmissions(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load submissions.');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleDeleteDraft = async () => {
    if (!deletingSubmission) return;
    setDeleteLoading(true);
    try {
      await apiService.delete(`/api/v1/submissions/${deletingSubmission.id}`);
      setDeletingSubmission(null);
      await fetchSubmissions();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to delete draft.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: MRT_ColumnDef<Submission>[] = [
    {
      accessorKey: 'request_number',
      header: 'Request #',
      size: 200,
      Cell: ({ cell, row }) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', color: 'primary.main' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/submissions/${row.original.id}`); }}
        >
          {cell.getValue<string>()}
        </Typography>
      ),
    },
    {
      accessorFn: (row) => row.form?.name || row.form_name || row.form_code || '—',
      id: 'form',
      header: 'Form',
      size: 180,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 160,
      Cell: ({ cell, row }) => (
        <StatusChip
          status={cell.getValue<Submission['status']>()}
          labelOverride={getDerivedSubmissionLabel(cell.getValue<Submission['status']>(), !!row.original.current_assignee)}
        />
      ),
    },
    {
      accessorKey: 'version_number',
      header: 'Version',
      size: 90,
      muiTableHeadCellProps: { align: 'center' },
      muiTableBodyCellProps: { align: 'center' },
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      size: 160,
      Cell: ({ cell }) => (
        <Tooltip title={formatLocalDateTime(cell.getValue<string>())}>
          <Typography variant="body2" color="text.secondary">
            {formatRelativeDateTime(cell.getValue<string>())}
          </Typography>
        </Tooltip>
      ),
    },
  ];

  const statusChips = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Under Approval', value: 'under_review' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Needs Correction', value: 'needs_correction' },
  ];

  const table = useMaterialReactTable({
    columns,
    data: submissions,
    enableExpanding: true,
    enableColumnFilters: false,
    enableSorting: false,
    enableColumnActions: false,
    enableDensityToggle: true,
    enableGlobalFilter: false,
    enableFullScreenToggle: true,
    enablePagination: true,
    manualPagination: true,
    rowCount: total,
    initialState: { density: 'compact' },
    state: {
      pagination: { pageIndex: page, pageSize: PAGE_SIZE },
    },
    onPaginationChange: (updater) => {
      const newState = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize: PAGE_SIZE })
        : updater;
      setPage(newState.pageIndex);
    },
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchBar placeholder="Search by request number..." onSearch={handleSearch} />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {statusChips.map((chip) => (
            <Chip
              key={chip.value}
              label={chip.label}
              size="small"
              variant={statusFilter === chip.value ? 'filled' : 'outlined'}
              color={statusFilter === chip.value ? 'primary' : 'default'}
              onClick={() => { setStatusFilter(chip.value); setPage(0); }}
            />
          ))}
        </Box>
      </Box>
    ),
    renderToolbarInternalActions: () => (
      <Tooltip title="Refresh">
        <IconButton onClick={fetchSubmissions} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    renderDetailPanel: ({ row }) => {
      const submission = row.original;
      const statusSummary = getStatusSummary(submission.status, !!submission.current_assignee);
      const canEdit = submission.status === 'draft'
        || submission.status === 'needs_correction';

      return (
        <Box
          sx={{
            px: 3,
            py: 2.5,
            bgcolor: 'background.default',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' },
              gap: 2,
            }}
          >
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Lifecycle Snapshot
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }} useFlexGap>
                <StatusChip
                  status={submission.status}
                  labelOverride={getDerivedSubmissionLabel(submission.status, !!submission.current_assignee)}
                />
                <Chip label={statusSummary.stage} size="small" variant="outlined" />
                <Chip label={`Version ${submission.version_number}`} size="small" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                {statusSummary.detail}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Next step
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusSummary.nextAction}
              </Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                Request Summary
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Request #</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {submission.request_number}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Form</Typography>
                  <Typography variant="body2">
                    {submission.form?.name || submission.form_name || submission.form_code || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body2">
                    {formatLocalDateTime(submission.updated_at)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Submitted</Typography>
                  <Typography variant="body2">
                    {submission.submitted_at ? formatLocalDateTime(submission.submitted_at) : 'Not submitted yet'}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }} useFlexGap>
                <Button size="small" variant="outlined" onClick={() => navigate(`/submissions/${submission.id}`)}>
                  View Details
                </Button>
                {canEdit && (
                  <Button size="small" variant="contained" onClick={() => navigate(`/submissions/${submission.id}/edit`)}>
                    Resume Editing
                  </Button>
                )}
                {submission.status === 'approved' && (
                  <Button size="small" variant="outlined" onClick={() => navigate(`/print/${submission.id}`)}>
                    Print
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      );
    },
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="View">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/submissions/${row.original.id}`); }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
        {(row.original.status === 'draft' || row.original.status === 'needs_correction') && (
          <Tooltip title="Edit">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/submissions/${row.original.id}/edit`); }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.original.status === 'draft' && (
          <Tooltip title="Delete Draft">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeletingSubmission(row.original); }}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.original.status === 'approved' && (
          <Tooltip title="Print">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/print/${row.original.id}`); }}>
              <Print fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    ),
    displayColumnDefOptions: {
      'mrt-row-expand': { header: '', size: 60 },
      'mrt-row-actions': { header: '', size: 120 },
    },
    muiTablePaperProps: {
      sx: { borderRadius: 3 },
    },
    muiTableBodyRowProps: ({ row }) => ({
      hover: true,
      sx: { cursor: 'pointer' },
      onClick: () => navigate(`/submissions/${row.original.id}`),
    }),
    muiTableBodyCellProps: {
      sx: { py: 1.5 },
    },
  });

  return (
    <Box>
      <PageHeader
        title="My Submissions"
        subtitle={loading ? 'Loading...' : `${total} submission${total !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'My Submissions' }]}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/my-forms')}>
            New Submission
          </Button>
        }
      />

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchSubmissions}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ minHeight: 44 }}>
          <Tab value="submissions" label="Submissions" sx={{ textTransform: 'none' }} />
          <Tab value="guide" label="Lifecycle Guide" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Box>

      {activeTab === 'guide' && <RequestLifecycleGuide context="submitter" />}

      {/* Loading */}
      {activeTab === 'submissions' && loading && !error && <LoadingSkeleton variant="table" rows={8} />}

      {/* Empty */}
      {activeTab === 'submissions' && !loading && !error && submissions.length === 0 && (
        <EmptyState
          title="No submissions found"
          description={search || statusFilter ? 'Try adjusting your search or filters.' : 'Create your first submission to get started.'}
          actionLabel="New Submission"
          onAction={() => navigate('/my-forms')}
        />
      )}

      {/* Table */}
      {activeTab === 'submissions' && !loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}

      <ConfirmDialog
        open={!!deletingSubmission}
        title="Delete Draft"
        message="Delete this draft? This will remove the unfinished submission and its temporary draft identifier."
        confirmLabel="Delete Draft"
        confirmColor="error"
        loading={deleteLoading}
        onConfirm={handleDeleteDraft}
        onCancel={() => setDeletingSubmission(null)}
      />
    </Box>
  );
}
