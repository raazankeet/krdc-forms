import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Chip, IconButton, Tooltip, Alert,
  TextField, Stack, MenuItem, Card,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Refresh, InfoOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import { formatLocalDateTime, formatRelativeDateTime } from '../../utils/dateTime';
import type { AuditLog, PaginatedResponse } from '../../types';

const PAGE_SIZE = 15;

const ACTIONS = ['', 'login', 'logout', 'user.create', 'user.update', 'user.delete',
  'form.create', 'form.update', 'submission.create', 'submission.update',
  'submission.submit', 'submission.approve', 'submission.reject', 'submission.request_changes',
  'role.create', 'role.update'];

const ENTITY_TYPES = ['', 'user', 'form', 'submission', 'role'];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    date_from: '', date_to: '', user_id: '', action: '', entity_type: '', entity_id: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: page + 1, page_size: PAGE_SIZE };
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.action) params.action = filters.action;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.entity_id) params.entity_id = filters.entity_id;

      const res = await apiService.get<PaginatedResponse<AuditLog>>('/api/v1/audit', params);
      setLogs(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load audit log.');
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearFilters = () => {
    setFilters({ date_from: '', date_to: '', user_id: '', action: '', entity_type: '', entity_id: '' });
    setPage(0);
  };

  const columns: MRT_ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      size: 180,
      Cell: ({ cell }) => (
        <Tooltip title={formatLocalDateTime(cell.getValue<string>())}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {formatRelativeDateTime(cell.getValue<string>())}
          </Typography>
        </Tooltip>
      ),
    },
    {
      accessorKey: 'user_role',
      header: 'Role',
      size: 120,
      Cell: ({ cell }) => <Chip label={cell.getValue<string>()} size="small" variant="outlined" />,
    },
    {
      accessorKey: 'action',
      header: 'Action',
      size: 180,
      Cell: ({ cell }) => {
        const val = cell.getValue<string>();
        return (
          <Chip
            label={val.replace(/_/g, ' ')}
            size="small"
            color={
              val.includes('create') ? 'success' :
              val.includes('delete') ? 'error' :
              val.includes('approve') ? 'success' :
              val.includes('reject') ? 'error' : 'primary'
            }
          />
        );
      },
    },
    {
      accessorKey: 'entity_type',
      header: 'Entity',
      size: 120,
      Cell: ({ cell }) => (
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {cell.getValue<string>()}
        </Typography>
      ),
    },
    {
      accessorKey: 'entity_id',
      header: 'Entity ID',
      size: 100,
      Cell: ({ cell }) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {cell.getValue<string>()}
        </Typography>
      ),
    },
    {
      accessorKey: 'ip_address',
      header: 'IP Address',
      size: 140,
      Cell: ({ cell }) => (
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {cell.getValue<string>() || '—'}
        </Typography>
      ),
    },
  ];

  const table = useMaterialReactTable({
    columns,
    data: logs,
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
        <IconButton onClick={fetchLogs} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    muiTablePaperProps: {
      sx: { borderRadius: 3 },
    },
    muiTableBodyCellProps: {
      sx: { py: 1.5 },
    },
    muiTableBodyRowProps: {
      hover: true,
    },
  });

  return (
    <Box>
      <PageHeader
        title="Audit Log"
        subtitle="Immutable system activity records"
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Audit' }]}
        actions={
          <Tooltip title="Refresh"><IconButton onClick={fetchLogs} disabled={loading}><Refresh /></IconButton></Tooltip>
        }
      />

      <Card sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InfoOutlined fontSize="small" />
          <Typography variant="body2">Audit records are immutable and cannot be modified or deleted.</Typography>
        </Stack>
      </Card>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" label="Date From" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
        <TextField size="small" label="Date To" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
        <TextField size="small" label="User ID" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })} sx={{ width: 100 }} />
        <TextField size="small" select label="Action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} sx={{ width: 180 }}>
          {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a || 'All'}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Entity" value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} sx={{ width: 130 }}>
          {ENTITY_TYPES.map((et) => <MenuItem key={et} value={et}>{et || 'All'}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Entity ID" value={filters.entity_id} onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })} sx={{ width: 100 }} />
        <Button size="small" variant="outlined" onClick={clearFilters}>Clear</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchLogs}>Retry</Button>}>{error}</Alert>}
      {loading && !error && <LoadingSkeleton variant="table" rows={10} />}
      {!loading && !error && logs.length === 0 && <EmptyState title="No audit entries" description="No audit log entries match your filters." />}
      {!loading && !error && logs.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
