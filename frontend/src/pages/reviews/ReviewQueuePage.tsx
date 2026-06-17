import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Typography, IconButton, Tooltip, Grid, Alert, Button, Tabs, Tab,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Visibility, Refresh, HourglassEmpty, CheckCircle, RateReview, AccessTime } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import RequestLifecycleGuide from '../../components/common/RequestLifecycleGuide';
import type { Submission, PaginatedResponse, ReviewerDashboardStats } from '../../types';

const PAGE_SIZE = 10;

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ReviewerDashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'guide'>('queue');

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
        <Tooltip title={cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : ''}>
          <Typography variant="body2" color="text.secondary">
            {cell.getValue<string>() ? formatDistanceToNow(new Date(cell.getValue<string>()), { addSuffix: true }) : '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 160,
      Cell: ({ cell }) => (
        <StatusChip status={cell.getValue<Submission['status']>()} />
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
      <Tooltip title="Review">
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

  const statCards = [
    { label: 'Pending', value: stats?.pending_reviews ?? '—', icon: <HourglassEmpty fontSize="large" color="warning" />, color: 'warning' },
    { label: 'Under Review', value: '—', icon: <RateReview fontSize="large" color="info" />, color: 'info' },
    { label: 'Reviewed Today', value: stats?.reviewed_today ?? '—', icon: <CheckCircle fontSize="large" color="success" />, color: 'success' },
    { label: 'Avg Review Time', value: stats?.avg_review_time_hours ? `${stats.avg_review_time_hours}h` : '—', icon: <AccessTime fontSize="large" sx={{ color: 'grey.600' }} />, color: 'default' },
  ];

  return (
    <Box>
      <PageHeader
        title="Review Queue"
        subtitle="Submissions awaiting your review"
        breadcrumbs={[{ label: 'Review Queue' }]}
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
          <Tab value="queue" label="Review Queue" sx={{ textTransform: 'none' }} />
          <Tab value="guide" label="Lifecycle Guide" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Box>

      {activeTab === 'guide' && <RequestLifecycleGuide context="reviewer" />}

      {/* Stats */}
      {activeTab === 'queue' && <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((card, idx) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
            <Card sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: card.color === 'default' ? 'grey.100' : `${card.color}.light`,
              }}>
                {card.icon}
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">{card.label}</Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchData}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {activeTab === 'queue' && loading && !error && <LoadingSkeleton variant="table" rows={8} />}

      {/* Empty */}
      {activeTab === 'queue' && !loading && !error && submissions.length === 0 && (
        <EmptyState
          title="No pending reviews"
          description="There are no submissions waiting for your review at this time."
        />
      )}

      {/* Table */}
      {activeTab === 'queue' && !loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
