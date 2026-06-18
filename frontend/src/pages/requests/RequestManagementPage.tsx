import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Tooltip, Alert, Button, Tabs, Tab,
  TextField, MenuItem, Stack,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Refresh, Visibility } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import RequestLifecycleGuide from '../../components/common/RequestLifecycleGuide';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalDateTime, formatRelativeDateTime } from '../../utils/dateTime';
import { getDerivedSubmissionLabel } from '../../utils/requestLifecycle';
import type { Submission, PaginatedResponse } from '../../types';

const PAGE_SIZE = 15;
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_correction', label: 'Needs Correction' },
];

export default function RequestManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeView, setActiveView] = useState<'requests' | 'guide'>('requests');

  const isAdmin = user?.roles.some((role) => role.name === 'Administrator') ?? false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/submissions', {
        page: page + 1,
        page_size: PAGE_SIZE,
        ...(isAdmin ? { scope: 'all' } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });

      setSubmissions(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, statusFilter]);

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
      accessorFn: (row) => row.form_name || row.form_code || '-',
      id: 'form',
      header: 'Form',
      size: 160,
    },
    {
      accessorFn: (row) => row.submitted_by || row.submitter_name || '-',
      id: 'submitter',
      header: 'Submitter',
      size: 150,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 170,
      Cell: ({ cell, row }) => (
        <StatusChip
          status={cell.getValue<Submission['status']>()}
          labelOverride={getDerivedSubmissionLabel(cell.getValue<Submission['status']>(), !!row.original.current_assignee)}
        />
      ),
    },
    {
      accessorFn: (row) => row.submitted_at || row.created_at,
      id: 'submitted',
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
      accessorFn: (row) => row.updated_at,
      id: 'updated',
      header: 'Updated',
      size: 150,
      Cell: ({ cell }) => (
        <Tooltip title={formatLocalDateTime(cell.getValue<string>())}>
          <Typography variant="body2" color="text.secondary">
            {formatRelativeDateTime(cell.getValue<string>())}
          </Typography>
        </Tooltip>
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
      <Tooltip title="View">
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/submissions/${row.original.id}`, {
              state: {
                origin: 'requests',
                originPath: '/requests',
                originLabel: 'Request Management',
              },
            });
          }}
        >
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
    muiTableProps: {
      sx: { tableLayout: 'fixed' },
    },
    muiTableContainerProps: {
      sx: { overflowY: 'auto', overflowX: 'auto' },
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
        title="Request Management"
        subtitle={`${total} request${total !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Request Management' }]}
      />

      <Tabs
        value={activeView}
        onChange={(_, value) => setActiveView(value)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="requests" label="Requests" sx={{ textTransform: 'none' }} />
        <Tab value="guide" label="Lifecycle Guide" sx={{ textTransform: 'none' }} />
      </Tabs>

      {activeView === 'guide' && <RequestLifecycleGuide context="manager" />}

      {activeView === 'requests' && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) => {
              setPage(0);
              setStatusFilter(event.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchData}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {activeView === 'requests' && loading && !error && <LoadingSkeleton variant="table" rows={8} />}

      {activeView === 'requests' && !loading && !error && submissions.length === 0 && (
        <EmptyState
          title="No requests"
          description="No requests match the current filters."
        />
      )}

      {activeView === 'requests' && !loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
