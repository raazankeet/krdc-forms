import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography, Alert, Button } from '@mui/material';
import { Visibility, Refresh } from '@mui/icons-material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import { apiService } from '../../services/api';
import type { Submission, PaginatedResponse } from '../../types';

const PAGE_SIZE = 10;

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/reviews/my', {
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
  }, [page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

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
      accessorKey: 'status',
      header: 'Status',
      size: 150,
      Cell: ({ cell }) => <StatusChip status={cell.getValue<Submission['status']>()} />,
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      size: 150,
      Cell: ({ cell }) => (
        <Typography variant="body2" color="text.secondary">
          {cell.getValue<string>() ? formatDistanceToNow(new Date(cell.getValue<string>()), { addSuffix: true }) : '—'}
        </Typography>
      ),
    },
  ];

  const table = useMaterialReactTable({
    columns,
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
        title="My Reviews"
        subtitle="Submissions assigned to you"
        breadcrumbs={[{ label: 'My Reviews' }]}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchReviews}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {loading && !error && <LoadingSkeleton variant="table" rows={6} />}
      {!loading && !error && submissions.length === 0 && (
        <EmptyState
          title="No reviews assigned"
          description="You don't have any submissions currently checked out for review."
        />
      )}
      {!loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
