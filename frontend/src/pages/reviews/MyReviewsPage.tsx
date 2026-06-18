import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, IconButton, Tooltip, Typography, Alert, Button, Tabs, Tab } from '@mui/material';
import { Visibility, Refresh } from '@mui/icons-material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkflowActionLabel } from '../../utils/submissionStatus';
import { formatRelativeDateTime } from '../../utils/dateTime';
import { getDerivedSubmissionLabel } from '../../utils/requestLifecycle';
import type { Submission, PaginatedResponse } from '../../types';

const PAGE_SIZE = 10;

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const roleNames = user?.roles.map((role) => role.name) || [];
  const isApproverOnly = roleNames.includes('Approver') && !roleNames.includes('Reviewer');

  const title = isApproverOnly
    ? activeTab === 'active' ? 'Approval Queue' : 'Approval Records'
    : activeTab === 'active' ? 'My Reviews' : 'Review Records';
  const subtitle = isApproverOnly
    ? activeTab === 'active'
      ? 'Requests waiting for your approval action'
      : 'Requests you have already approved or returned'
    : activeTab === 'active'
      ? 'Requests in your reviewer or approver lane'
      : 'Requests you have already completed at your stage';

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/reviews/my', {
        scope: activeTab,
        page: page + 1,
        page_size: PAGE_SIZE,
      });
      setSubmissions(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load assigned reviews.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    setPage(0);
  }, [activeTab]);

  const activeColumns: MRT_ColumnDef<Submission>[] = [
    {
      accessorKey: 'request_number',
      header: 'Request #',
      size: 200,
      Cell: ({ cell }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {cell.getValue<string>()}
        </Typography>
      ),
    },
    {
      accessorFn: (row) => row.form_name || row.form_code || '—',
      id: 'form',
      header: 'Form',
      size: 160,
    },
    {
      accessorFn: (row) => row.submitted_by || row.submitter_name || row.user?.full_name || '—',
      id: 'submitter',
      header: 'Submitter',
      size: 150,
    },
    {
      accessorFn: (row) => (row.is_checked_out_by_me ? 'Checked Out' : 'Available'),
      id: 'assignment_state',
      header: 'Assignment',
      size: 140,
      Cell: ({ row }) => (
        <Chip
          size="small"
          variant="outlined"
          color={row.original.is_checked_out_by_me ? 'primary' : 'default'}
          label={row.original.is_checked_out_by_me ? 'Checked Out' : 'Available'}
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 150,
      Cell: ({ cell }) => (
        <StatusChip
          status={cell.getValue<Submission['status']>()}
          size="small"
          labelOverride={getDerivedSubmissionLabel(cell.getValue<Submission['status']>(), !!cell.row.original.current_assignee)}
        />
      ),
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      size: 150,
      Cell: ({ cell }) => (
        <Typography variant="body2" color="text.secondary">
          {formatRelativeDateTime(cell.getValue<string>())}
        </Typography>
      ),
    },
  ];

  const historyColumns: MRT_ColumnDef<Submission>[] = [
    {
      accessorKey: 'request_number',
      header: 'Request #',
      size: 200,
      Cell: ({ cell }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {cell.getValue<string>()}
        </Typography>
      ),
    },
    {
      accessorFn: (row) => row.form_name || row.form_code || '—',
      id: 'form',
      header: 'Form',
      size: 160,
    },
    {
      accessorFn: (row) => row.submitted_by || row.submitter_name || row.user?.full_name || '—',
      id: 'submitter',
      header: 'Submitter',
      size: 150,
    },
    {
      accessorKey: 'last_action',
      header: isApproverOnly ? 'Decision' : 'Outcome',
      size: 180,
      Cell: ({ row }) => (
        <Chip
          size="small"
          color={row.original.last_action === 'approve' ? 'success' : row.original.last_action === 'reject' ? 'error' : 'warning'}
          label={getWorkflowActionLabel(row.original.last_action || 'updated')}
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Current Status',
      size: 160,
      Cell: ({ cell }) => (
        <StatusChip
          status={cell.getValue<Submission['status']>()}
          size="small"
          labelOverride={getDerivedSubmissionLabel(cell.getValue<Submission['status']>(), !!cell.row.original.current_assignee)}
        />
      ),
    },
    {
      accessorKey: 'handled_at',
      header: isApproverOnly ? 'Approved / Returned' : 'Handled At',
      size: 180,
      Cell: ({ cell }) => (
        <Typography variant="body2" color="text.secondary">
          {formatRelativeDateTime(cell.getValue<string>())}
        </Typography>
      ),
    },
  ];

  const table = useMaterialReactTable({
    columns: activeTab === 'active' ? activeColumns : historyColumns,
    data: submissions,
    enableColumnFilters: false,
    enableSorting: false,
    enableColumnActions: false,
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
    enableDensityToggle: true,
    manualPagination: true,
    rowCount: total,
    state: {
      pagination: { pageIndex: page, pageSize: PAGE_SIZE },
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize: PAGE_SIZE })
        : updater;
      setPage(next.pageIndex);
    },
    renderToolbarInternalActions: () => (
      <Tooltip title="Refresh">
        <IconButton onClick={fetchReviews} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    renderRowActions: ({ row }) => (
      <Tooltip title="Open review">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${row.original.id}`); }}>
          <Visibility fontSize="small" />
        </IconButton>
      </Tooltip>
    ),
    displayColumnDefOptions: {
      'mrt-row-actions': { header: '', size: 80 },
    },
    muiTableBodyRowProps: ({ row }) => ({
      hover: true,
      sx: { cursor: 'pointer' },
      onClick: () => navigate(`/reviews/${row.original.id}`),
    }),
  });

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: title }]}
      />
      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ minHeight: 44 }}>
          <Tab
            value="active"
            label={isApproverOnly ? 'Active Approval Queue' : 'Active Work'}
            sx={{ textTransform: 'none' }}
          />
          <Tab
            value="history"
            label={isApproverOnly ? 'Approval Records' : 'Review Records'}
            sx={{ textTransform: 'none' }}
          />
        </Tabs>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchReviews}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {loading && !error && <LoadingSkeleton variant="table" rows={6} />}
      {!loading && !error && submissions.length === 0 && (
        <EmptyState
          title={activeTab === 'active' ? 'No active work' : isApproverOnly ? 'No approval records yet' : 'No review records yet'}
          description={
            activeTab === 'active'
              ? 'You do not currently have any requests available or checked out in your workflow lane.'
              : isApproverOnly
                ? 'Requests you approve or return will appear here.'
                : 'Requests you complete or return at the review stage will appear here.'
          }
        />
      )}
      {!loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
