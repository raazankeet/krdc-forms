import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Chip, IconButton, Tooltip, Alert,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Refresh } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import { formatLocalDateTime, formatRelativeDateTime } from '../../utils/dateTime';
import type { AuditLog, PaginatedResponse } from '../../types';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: page + 1, page_size: pageSize };
      const res = await apiService.get<PaginatedResponse<AuditLog>>('/api/v1/audit', params);
      setLogs(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load audit log.');
    } finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

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
      accessorKey: 'user_name',
      header: 'User',
      size: 160,
      Cell: ({ cell }) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {cell.getValue<string>() || 'System'}
        </Typography>
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
              val.includes('reject') ? 'error' :
              val.includes('login') ? 'info' :
              val.includes('logout') ? 'default' : 'primary'
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
  ];

  const table = useMaterialReactTable({
    columns,
    data: logs,
    enableColumnFilters: true,
    enableSorting: true,
    enableColumnActions: true,
    enableDensityToggle: true,
    enableGlobalFilter: true,
    enableFullScreenToggle: true,
    enableColumnOrdering: true,
    enableHiding: true,
    enablePagination: true,
    manualPagination: true,
    rowCount: total,
    initialState: { density: 'compact' },
    state: {
      pagination: { pageIndex: page, pageSize },
    },
    onPaginationChange: (updater) => {
      const newState = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize })
        : updater;
      setPage(newState.pageIndex);
      setPageSize(newState.pageSize);
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
    renderDetailPanel: ({ row }) => {
      const log = row.original;
      const requestNumber = (log.new_value?.request_number as string) || log.entity_label;
      const formName = (log.new_value?.form_name as string) || log.entity_form;

      return (
        <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {requestNumber && (
            <Box>
              <Typography variant="caption" color="text.secondary">Request Number</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {requestNumber}
              </Typography>
            </Box>
          )}
          {formName && (
            <Box>
              <Typography variant="caption" color="text.secondary">Form</Typography>
              <Typography variant="body2">{formName}</Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">Event ID</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {log.event_id}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Exact Timestamp</Typography>
            <Typography variant="body2">
              {formatLocalDateTime(log.timestamp)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">User</Typography>
            <Typography variant="body2">
              {log.user_name || 'System'} (ID: {log.user_id ?? '—'})
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">IP Address</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {log.ip_address || '—'}
            </Typography>
          </Box>
          {log.old_value && Object.keys(log.old_value).length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Previous State</Typography>
              <Box
                component="pre"
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: 120,
                }}
              >
                {JSON.stringify(log.old_value, null, 2)}
              </Box>
            </Box>
          )}
          {log.new_value && Object.keys(log.new_value).length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">New State</Typography>
              <Box
                component="pre"
                sx={{
                  mt: 0.5,
                  p: 1.5,
                  bgcolor: 'success.50',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: 120,
                }}
              >
                {JSON.stringify(log.new_value, null, 2)}
              </Box>
            </Box>
          )}
          {(!log.old_value || Object.keys(log.old_value).length === 0) &&
           (!log.new_value || Object.keys(log.new_value).length === 0) &&
           !requestNumber && !formName && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">No additional metadata for this event.</Typography>
            </Box>
          )}
        </Box>
      );
    },
  });

  return (
    <Box>
      <PageHeader
        title="Audit Log"
        subtitle="Immutable system activity records"
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Audit' }]}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchLogs}>Retry</Button>}>{error}</Alert>}
      {loading && !error && <LoadingSkeleton variant="table" rows={10} />}
      {!loading && !error && logs.length === 0 && <EmptyState title="No audit entries" description="No audit log entries match your filters." />}
      {!loading && !error && logs.length > 0 && (
        <MaterialReactTable table={table} />
      )}
    </Box>
  );
}
