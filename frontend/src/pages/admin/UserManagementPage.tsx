import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Avatar, Chip, IconButton, Tooltip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, Autocomplete, CircularProgress, Stack, Tabs, Tab,
  List, ListItem, ListItemText, ListItemAvatar, ListItemSecondaryAction,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Add, Edit, Refresh, PersonOff, Person, Assignment, Close } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useSnackbar } from 'notistack';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import SearchBar from '../../components/common/SearchBar';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { User, Role, PaginatedResponse, ApiResponse, AssignedForm, Form } from '../../types';

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [allForms, setAllForms] = useState<Form[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ username: '', email: '', full_name: '', password: '', is_active: true, role_ids: [] as number[] });
  const [formLoading, setFormLoading] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState<User | null>(null);

  // Form assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);
  const [selectedFormIds, setSelectedFormIds] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Detail panel state per user
  const [detailTabs, setDetailTabs] = useState<Record<number, number>>({});
  const [detailData, setDetailData] = useState<Record<number, {
    assignedForms?: AssignedForm[];
    submissions?: Array<{ id: number; request_number: string; status: string; created_at: string }>;
    loading: boolean;
  }>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page: page + 1, page_size: PAGE_SIZE };
      if (search) params.search = search;
      const res = await apiService.get<PaginatedResponse<User>>('/api/v1/users', params);
      setUsers(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load users.');
    } finally { setLoading(false); }
  }, [page, search]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiService.get<ApiResponse<Role[]>>('/api/v1/roles');
      setRoles(res.data || []);
    } catch {}
  }, []);

  const fetchAllForms = useCallback(async () => {
    try {
      const res = await apiService.get<ApiResponse<Form[]>>('/api/v1/forms');
      setAllForms(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); fetchRoles(); fetchAllForms(); }, [fetchUsers, fetchRoles, fetchAllForms]);

  // Fetch detail data when row expands
  const loadDetailData = useCallback(async (userId: number, tabIndex: number) => {
    setDetailTabs(prev => ({ ...prev, [userId]: tabIndex }));
    setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], loading: true } }));

    const current = detailData[userId] || { loading: false };

    if (tabIndex === 0 && !current.assignedForms) {
      try {
        const res = await apiService.get<ApiResponse<AssignedForm[]>>(`/api/v1/users/${userId}/assigned-forms`);
        setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], assignedForms: res.data, loading: false } }));
      } catch {
        setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], loading: false } }));
      }
    } else if (tabIndex === 2 && !current.submissions) {
      try {
        const res = await apiService.get<PaginatedResponse<{ id: number; request_number: string; status: string; created_at: string }>>(`/api/v1/users/${userId}/submissions`, { page: 1, page_size: 5 });
        setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], submissions: res.data || [], loading: false } }));
      } catch {
        setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], loading: false } }));
      }
    } else {
      setDetailData(prev => ({ ...prev, [userId]: { ...prev[userId], loading: false } }));
    }
  }, [detailData]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ username: '', email: '', full_name: '', password: '', is_active: true, role_ids: [] });
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      password: '',
      is_active: user.is_active,
      role_ids: user.roles.map((r) => r.id),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.email.trim()) return;
    setFormLoading(true);
    try {
      if (editingUser) {
        await apiService.put(`/api/v1/users/${editingUser.id}`, {
          email: formData.email,
          full_name: formData.full_name,
          is_active: formData.is_active,
          role_ids: formData.role_ids,
        });
        enqueueSnackbar('User updated.', { variant: 'success' });
      } else {
        await apiService.post('/api/v1/users', {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password,
          role_ids: formData.role_ids,
        });
        enqueueSnackbar('User created.', { variant: 'success' });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      enqueueSnackbar(axiosErr?.response?.data?.error?.message || 'Failed to save user.', { variant: 'error' });
    } finally { setFormLoading(false); }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiService.put(`/api/v1/users/${user.id}`, { is_active: !user.is_active });
      enqueueSnackbar(`User ${user.is_active ? 'disabled' : 'enabled'}.`, { variant: 'success' });
      setDisableConfirm(null);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      enqueueSnackbar(axiosErr?.response?.data?.error?.message || 'Failed.', { variant: 'error' });
    }
  };

  // Form assignment handlers
  const openAssignForms = async (user: User) => {
    setAssignTargetUser(user);
    setAssignLoading(true);
    try {
      const res = await apiService.get<ApiResponse<AssignedForm[]>>(`/api/v1/users/${user.id}/assigned-forms`);
      setSelectedFormIds((res.data || []).map(f => f.id));
    } catch {
      setSelectedFormIds([]);
    }
    setAssignLoading(false);
    setAssignDialogOpen(true);
  };

  const handleAssignForms = async () => {
    if (!assignTargetUser) return;
    setAssignLoading(true);
    try {
      await apiService.post(`/api/v1/users/${assignTargetUser.id}/assign-forms`, { form_ids: selectedFormIds });
      enqueueSnackbar('Forms assigned successfully.', { variant: 'success' });
      setAssignDialogOpen(false);
      // Clear cached detail data
      setDetailData(prev => {
        const next = { ...prev };
        if (next[assignTargetUser.id]) {
          next[assignTargetUser.id] = { ...next[assignTargetUser.id], assignedForms: undefined };
        }
        return next;
      });
      fetchUsers();
    } catch {
      enqueueSnackbar('Failed to assign forms.', { variant: 'error' });
    } finally { setAssignLoading(false); }
  };

  // Status chip helper
  const statusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'under_review': return 'warning';
      case 'submitted': return 'primary';
      case 'draft': return 'default';
      case 'needs_correction': return 'warning';
      default: return 'default';
    }
  };

  const columns: MRT_ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      size: 180,
      Cell: ({ cell, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
            {row.original.full_name?.[0] || row.original.username?.[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{cell.getValue<string>()}</Typography>
        </Box>
      ),
    },
    { accessorKey: 'email', header: 'Email', size: 200 },
    { accessorKey: 'full_name', header: 'Full Name', size: 160 },
    {
      accessorKey: 'roles',
      header: 'Roles',
      size: 220,
      Cell: ({ cell }) => {
        const roles = cell.getValue<User['roles']>();
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {roles.map((role) => (
              <Chip key={role.id} label={role.name} size="small" variant="outlined" />
            ))}
            {roles.length === 0 && (
              <Typography variant="caption" color="text.disabled">No role</Typography>
            )}
          </Box>
        );
      },
    },
    {
      accessorFn: (row) => row.assigned_form_count ?? 0,
      id: 'assigned_form_count',
      header: 'Forms',
      size: 80,
      muiTableHeadCellProps: { align: 'center' },
      muiTableBodyCellProps: { align: 'center' },
      Cell: ({ cell }) => (
        <Chip label={cell.getValue<number>()} size="small" color={cell.getValue<number>() > 0 ? 'primary' : 'default'} variant="outlined" />
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      size: 100,
      Cell: ({ cell }) => (
        <Chip
          size="small"
          label={cell.getValue<boolean>() ? 'Active' : 'Disabled'}
          color={cell.getValue<boolean>() ? 'success' : 'error'}
        />
      ),
    },
    {
      accessorKey: 'last_login_at',
      header: 'Last Login',
      size: 150,
      Cell: ({ cell }) => (
        <Typography variant="body2" color="text.secondary">
          {cell.getValue<string>() ? formatDistanceToNow(new Date(cell.getValue<string>()), { addSuffix: true }) : 'Never'}
        </Typography>
      ),
    },
  ];

  const table = useMaterialReactTable({
    columns,
    data: users,
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
    renderDetailPanel: ({ row }) => {
      const userId = row.original.id;
      const data = detailData[userId];
      const activeTab = detailTabs[userId] || 0;
      const roles = row.original.roles;

      return (
        <Box sx={{ p: 3, bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => loadDetailData(userId, v)} sx={{ mb: 2, minHeight: 40 }}>
            <Tab label={`Forms (${row.original.assigned_form_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label="Roles & Permissions" sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label="Recent Submissions" sx={{ minHeight: 40, textTransform: 'none' }} />
          </Tabs>

          {activeTab === 0 && (
            data?.loading ? <CircularProgress size={24} /> :
            data?.assignedForms && data.assignedForms.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {data.assignedForms.map(f => (
                  <Chip key={f.id} label={`${f.form_code} — ${f.name}`} size="small" color={f.is_active ? 'primary' : 'default'} variant="outlined" />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No forms assigned.</Typography>
            )
          )}

          {activeTab === 1 && (
            roles.length > 0 ? (
              <Stack spacing={1.5}>
                {roles.map(role => (
                  <Box key={role.id}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{role.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>{role.description}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {role.permissions?.map(p => (
                        <Chip key={p.id} label={p.code} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                      {(!role.permissions || role.permissions.length === 0) && (
                        <Typography variant="caption" color="text.disabled">No permissions</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">No roles assigned.</Typography>
            )
          )}

          {activeTab === 2 && (
            data?.loading ? <CircularProgress size={24} /> :
            data?.submissions && data.submissions.length > 0 ? (
              <List dense disablePadding>
                {data.submissions.map(s => (
                  <ListItem key={s.id} sx={{ px: 1, py: 0.5 }}>
                    <ListItemText
                      primary={s.request_number}
                      secondary={s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                    />
                    <Chip label={s.status.replace('_', ' ')} size="small" color={statusColor(s.status)} variant="outlined" />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No submissions yet.</Typography>
            )
          )}
        </Box>
      );
    },
    renderTopToolbarCustomActions: () => (
      <SearchBar placeholder="Search users..." onSearch={(v) => { setSearch(v); setPage(0); }} />
    ),
    renderToolbarInternalActions: () => (
      <Tooltip title="Refresh">
        <IconButton onClick={fetchUsers} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Manage Forms">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openAssignForms(row.original); }}>
            <Assignment fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
        <Tooltip title={row.original.is_active ? 'Disable' : 'Enable'}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDisableConfirm(row.original); }}>
            {row.original.is_active ? <PersonOff fontSize="small" color="warning" /> : <Person fontSize="small" color="success" />}
          </IconButton>
        </Tooltip>
      </Box>
    ),
    displayColumnDefOptions: {
      'mrt-row-actions': { header: '', size: 150 },
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
    muiTableBodyRowProps: {
      hover: true,
    },
    muiTableBodyCellProps: {
      sx: { py: 1.5 },
    },
  });

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle={`${total} user${total !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Users' }]}
        actions={<Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add User</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchUsers}>Retry</Button>}>{error}</Alert>}
      {loading && !error && <LoadingSkeleton variant="table" rows={8} />}
      {!loading && !error && users.length === 0 && (
        <EmptyState title="No users found" description={search ? 'Try adjusting your search.' : 'No users in the system.'} actionLabel="Add User" onAction={openCreate} />
      )}
      {!loading && !error && users.length > 0 && (
        <MaterialReactTable table={table} />
      )}

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} disabled={!!editingUser} fullWidth required />
            <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} fullWidth required />
            <TextField label="Full Name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} fullWidth />
            {!editingUser && (
              <TextField label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} fullWidth required helperText="Auto-generated if left empty" />
            )}
            <Autocomplete
              multiple options={roles}
              getOptionLabel={(r) => r.name}
              value={roles.filter((r) => formData.role_ids.includes(r.id))}
              onChange={(_, vals) => setFormData({ ...formData, role_ids: vals.map((v) => v.id) })}
              renderInput={(params) => <TextField {...params} label="Roles" />}
            />
            {editingUser && (
              <FormControlLabel
                control={<Switch checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />}
                label="Active"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={formLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={formLoading} startIcon={formLoading ? <CircularProgress size={16} /> : undefined}>
            {editingUser ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Forms Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Forms — {assignTargetUser?.full_name || assignTargetUser?.username}</DialogTitle>
        <DialogContent>
          {assignLoading ? <CircularProgress sx={{ mt: 2 }} /> : (
            <Autocomplete
              multiple
              options={allForms}
              getOptionLabel={(f) => `${f.form_code} — ${f.name}`}
              value={allForms.filter(f => selectedFormIds.includes(f.id))}
              onChange={(_, vals) => setSelectedFormIds(vals.map(v => v.id))}
              renderInput={(params) => <TextField {...params} label="Assigned Forms" sx={{ mt: 1 }} />}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignForms} disabled={assignLoading}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Disable Confirm */}
      <ConfirmDialog
        open={!!disableConfirm}
        title={disableConfirm?.is_active ? 'Disable User' : 'Enable User'}
        message={`Are you sure you want to ${disableConfirm?.is_active ? 'disable' : 'enable'} ${disableConfirm?.full_name || disableConfirm?.username}?`}
        confirmLabel={disableConfirm?.is_active ? 'Disable' : 'Enable'}
        confirmColor={disableConfirm?.is_active ? 'warning' : 'success'}
        onConfirm={() => disableConfirm && handleToggleActive(disableConfirm)}
        onCancel={() => setDisableConfirm(null)}
      />
    </Box>
  );
}
