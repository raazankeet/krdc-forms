import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, IconButton, Tooltip, Grid, Alert, Button, Tabs, Tab, Stack,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Visibility, Refresh, HourglassEmpty, CheckCircle, RateReview, AccessTime } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import RequestLifecycleGuide from '../../components/common/RequestLifecycleGuide';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalDateTime, formatRelativeDateTime } from '../../utils/dateTime';
import { getDerivedSubmissionLabel } from '../../utils/requestLifecycle';
import type { Submission, PaginatedResponse, ReviewerDashboardStats } from '../../types';

const PAGE_SIZE = 10;

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ReviewerDashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'guide'>('queue');
  const roleNames = user?.roles.map((role) => role.name) || [];
  const isApproverOnly = roleNames.includes('Approver') && !roleNames.includes('Reviewer');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subsRes, statsRes] = await Promise.all([
        apiService.get<PaginatedResponse<Submission>>('/api/v1/reviews/pending', {
          page: page + 1,
          page_size: PAGE_SIZE,
        }),
        apiService.get<{ success: boolean; data: ReviewerDashboardStats }>('/api/v1/reports/reviewer/dashboard'),
      ]);
      setSubmissions(subsRes.data || []);
      setTotal(subsRes.pagination?.total || 0);
      setStats(statsRes.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: MRT_ColumnDef<Submission>[] = [
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
      accessorFn: (row) => row.form_name || row.form?.name || row.form_code || '—',
      id: 'form',
      header: 'Form',
      size: 160,
    },
    {
      accessorFn: (row) => row.submitted_by || row.submitter_name || row.user?.full_name || row.user?.username || '—',
      id: 'user',
      header: 'Submitter',
      size: 150,
    },
    {
      accessorKey: 'submitted_at',
      header: 'Submitted',
      size: 150,
      Cell: ({ cell }) => (
        <Tooltip title={formatLocalDateTime(cell.getValue<string>())}>
          <Typography variant="body2" color="text.secondary">
            {formatRelativeDateTime(cell.getValue<string>())}
          </Typography>
        </Tooltip>
      ),
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
  ];

  const table = useMaterialReactTable({
    columns,
    data: submissions,
    enableColumnFilters: false,
    enableSorting: false,
    enableColumnActions: false,
    enableDensityToggle: true,
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
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
    renderToolbarInternalActions: () => (
      <Tooltip title="Refresh">
        <IconButton onClick={fetchData} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    renderRowActions: ({ row }) => (
      <Tooltip title={isApproverOnly ? 'Open approval' : 'Open review'}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${row.original.id}`); }}>
          <Visibility fontSize="small" />
        </IconButton>
      </Tooltip>
    ),
    displayColumnDefOptions: {
      'mrt-row-actions': { header: '', size: 80 },
    },
    muiTablePaperProps: {
      sx: { borderRadius: 3 },
    },
    muiTableBodyRowProps: ({ row }) => ({
      hover: true,
      sx: { cursor: 'pointer' },
      onClick: () => navigate(`/reviews/${row.original.id}`),
    }),
    muiTableBodyCellProps: {
      sx: { py: 1.5 },
    },
  });


  return (
    <Box>
      <PageHeader
        title={isApproverOnly ? 'Approval Queue' : 'Review Queue'}
        breadcrumbs={[{ label: isApproverOnly ? 'Approval Queue' : 'Review Queue' }]}
        actions={
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        }
      />

      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ minHeight: 44 }}>
          <Tab value="queue" label={isApproverOnly ? 'Approval Queue' : 'Review Queue'} sx={{ textTransform: 'none' }} />
          <Tab value="guide" label="Lifecycle Guide" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Box>

      {activeTab === 'guide' && <RequestLifecycleGuide context="reviewer" />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchData}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {activeTab === 'queue' && loading && !error && <LoadingSkeleton variant="table" rows={8} />}

      {activeTab === 'queue' && !loading && !error && submissions.length === 0 && (
        <EmptyState
          title={isApproverOnly ? 'No pending approvals' : 'No pending reviews'}
          description={isApproverOnly ? 'There are no submissions waiting for your approval at this time.' : 'There are no submissions waiting for your review at this time.'}
        />
      )}

      {activeTab === 'queue' && !loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
