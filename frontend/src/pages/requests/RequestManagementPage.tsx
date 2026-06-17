import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Tooltip, Alert, Button, Tabs, Tab,
  TextField, MenuItem, Stack,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Refresh, Visibility } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import RequestLifecycleGuide from '../../components/common/RequestLifecycleGuide';
import { useAuth } from '../../contexts/AuthContext';
import type { Submission, PaginatedResponse } from '../../types';

const PAGE_SIZE = 15;
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_correction', label: 'Needs Correction' },
];

type RequestTab = 'all' | 'pending' | 'my-reviews' | 'my-requests';

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

  const userRoles = user?.roles.map(r => r.name) || [];
  const isAdmin = userRoles.includes('Administrator');
  const isReviewer = userRoles.includes('Reviewer') || userRoles.includes('Approver');
  // Determine starting tab
  const [activeTab, setActiveTab] = useState<RequestTab>(() => {
    if (isAdmin) return 'all';
    if (isReviewer) return 'pending';
    return 'my-requests';
  });

  useEffect(() => {
    const availableTabs: RequestTab[] = [
      ...(isAdmin ? ['all'] as const : []),
      ...(isAdmin || isReviewer ? ['pending', 'my-reviews'] as const : []),
      'my-requests',
    ];
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(isAdmin ? 'all' : isReviewer ? 'pending' : 'my-requests');
    }
  }, [activeTab, isAdmin, isReviewer]);

  const tabs: { value: RequestTab; label: string; show: boolean }[] = [
    { value: 'all', label: 'All Requests', show: isAdmin },
    { value: 'pending', label: 'Pending Review', show: isAdmin || isReviewer },
    { value: 'my-reviews', label: 'My Reviews', show: isAdmin || isReviewer },
    { value: 'my-requests', label: 'My Requests', show: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let res: { data: Submission[]; pagination?: { total: number } };

      if (activeTab === 'pending') {
        res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/reviews/pending', {
          page: page + 1, page_size: PAGE_SIZE,
        });
      } else if (activeTab === 'my-reviews') {
        res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/reviews/my', {
          page: page + 1, page_size: PAGE_SIZE,
        });
      } else {
        // 'all' or 'my-requests' — the backend already filters by role
        res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/submissions', {
          page: page + 1,
          page_size: PAGE_SIZE,
          ...(activeTab === 'all' && isAdmin ? { scope: 'all' } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        });
      }

      setSubmissions(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, statusFilter, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination when tab or filter changes
  const handleTabChange = (_: unknown, v: RequestTab) => {
    setPage(0);
    setActiveTab(v);
  };
  const handleStatusFilter = (v: string) => {
    setPage(0);
    setStatusFilter(v);
  };

  const shouldOpenInReview = useCallback((submission: Submission) => {
    if (activeTab === 'pending' || activeTab === 'my-reviews') {
      return true;
    }
    if (!isAdmin && !isReviewer) {
      return false;
    }
    return submission.status === 'submitted' || submission.status === 'under_review';
  }, [activeTab, isAdmin, isReviewer]);

  const getDetailPath = useCallback((submission: Submission) => {
    if (shouldOpenInReview(submission)) {
      return `/reviews/${submission.id}`;
    }
    return `/submissions/${submission.id}`;
  }, [shouldOpenInReview]);

  const openDetail = useCallback((submission: Submission) => {
    navigate(getDetailPath(submission), {
      state: {
        origin: 'requests',
        originPath: '/requests',
        originLabel: 'Request Management',
        requestTab: activeTab,
      },
    });
  }, [activeTab, getDetailPath, navigate]);

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
      accessorFn: (row) => row.submitted_by || row.submitter_name || '—',
      id: 'submitter',
      header: 'Submitter',
      size: 150,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 170,
      filterVariant: 'select',
      filterSelectOptions: STATUS_OPTIONS.filter(o => o.value).map(o => o.label),
      Cell: ({ cell }) => <StatusChip status={cell.getValue<Submission['status']>()} />,
    },
    {
      accessorFn: (row) => row.submitted_at || row.created_at,
      id: 'submitted',
      header: 'Submitted',
      size: 150,
      Cell: ({ cell }) => (
        <Tooltip title={cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : ''}>
          <Typography variant="body2" color="text.secondary">
            {cell.getValue<string>()
              ? formatDistanceToNow(new Date(cell.getValue<string>()), { addSuffix: true })
              : '—'}
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
        <Tooltip title={cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : ''}>
          <Typography variant="body2" color="text.secondary">
            {cell.getValue<string>()
              ? formatDistanceToNow(new Date(cell.getValue<string>()), { addSuffix: true })
              : '—'}
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
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(row.original); }}>
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
      onClick: () => openDetail(row.original),
    }),
    muiTableBodyCellProps: {
      sx: { py: 1.5 },
    },
  });

  const tabLabel = tabs.find(t => t.value === activeTab)?.label || 'Requests';

  return (
    <Box>
      <PageHeader
        title="Request Management"
        subtitle={`${total} ${tabLabel.toLowerCase()}`}
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

      {/* Tabs */}
      {activeView === 'requests' && <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.filter(t => t.show).map(t => (
          <Tab key={t.value} value={t.value} label={t.label} sx={{ textTransform: 'none' }} />
        ))}
      </Tabs>}

      {/* Status filter (only for tabs that use /submissions endpoint) */}
      {activeView === 'requests' && (activeTab === 'all' || activeTab === 'my-requests') && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {STATUS_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchData}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {activeView === 'requests' && loading && !error && <LoadingSkeleton variant="table" rows={8} />}

      {/* Empty */}
      {activeView === 'requests' && !loading && !error && submissions.length === 0 && (
        <EmptyState
          title="No requests"
          description={
            activeTab === 'pending'
              ? 'There are no submissions waiting for review.'
              : activeTab === 'my-requests'
                ? 'You have not submitted any requests yet.'
                : 'No requests match the current filters.'
          }
        />
      )}

      {/* Table */}
      {activeView === 'requests' && !loading && !error && submissions.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
