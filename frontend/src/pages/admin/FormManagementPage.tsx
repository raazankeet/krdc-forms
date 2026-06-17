import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Chip, IconButton, Tooltip, Alert, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Stack, MenuItem, FormControlLabel, Tabs, Tab, Slider,
  Avatar, Autocomplete,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Add, Edit, Refresh, PersonAdd, RateReview } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import type { Form, PaginatedResponse, ApiResponse, FormFieldDefinition, AssignedUser, User } from '../../types';

const DEFAULT_PRINT_SCALE = 0.94;
const MIN_PRINT_SCALE = 0;
const MAX_PRINT_SCALE = 1;

function scaleToPercent(scale?: number) {
  return Math.round((scale ?? DEFAULT_PRINT_SCALE) * 100);
}

function percentToScale(percent: number) {
  const normalized = Number.isFinite(percent) ? percent / 100 : DEFAULT_PRINT_SCALE;
  return Math.min(MAX_PRINT_SCALE, Math.max(MIN_PRINT_SCALE, normalized));
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'rating', label: 'Rating' },
];

export default function FormManagementPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState({
    form_code: '', name: '', description: '', is_active: true,
    requires_approval: true, approval_levels: 1,
    print_scale: DEFAULT_PRINT_SCALE,
    numbering_prefix: '', numbering_year_reset: true,
    field_definitions: [] as Array<{
      field_name: string; field_label: string; field_type: string;
      is_required: boolean; validation_rules: string; options: string;
      display_order: number;
    }>,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Assign dialog — one dialog, two sections (Submitters + Reviewers)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetForm, setAssignTargetForm] = useState<Form | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedSubmitters, setSelectedSubmitters] = useState<number[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Detail panel
  const [detailTabs, setDetailTabs] = useState<Record<number, number>>({});
  const [detailData, setDetailData] = useState<Record<number, {
    submitters?: AssignedUser[];
    reviewers?: AssignedUser[];
    loading: boolean;
  }>>({});

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<PaginatedResponse<Form>>('/api/v1/forms', { page: page + 1, page_size: 10 });
      setForms(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load forms.');
    } finally { setLoading(false); }
  }, [page]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await apiService.get<ApiResponse<User[]>>('/api/v1/users', { page_size: 100 });
      setAllUsers(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchForms(); fetchAllUsers(); }, [fetchForms, fetchAllUsers]);

  // Load detail data on row expand
  const loadDetailData = useCallback(async (formId: number, tabIndex: number) => {
    setDetailTabs(prev => ({ ...prev, [formId]: tabIndex }));
    const current = detailData[formId];
    const needsFetch = (tabIndex === 0 || tabIndex === 1) && (!current?.submitters && !current?.reviewers);
    if (!needsFetch) return;

    setDetailData(prev => ({ ...prev, [formId]: { ...prev[formId], loading: true } }));
    try {
      const res = await apiService.get<ApiResponse<{ submitters: AssignedUser[]; reviewers: AssignedUser[] }>>(
        `/api/v1/forms/${formId}/assigned-users`
      );
      setDetailData(prev => ({
        ...prev,
        [formId]: {
          submitters: res.data?.submitters || [],
          reviewers: res.data?.reviewers || [],
          loading: false,
        },
      }));
    } catch {
      setDetailData(prev => ({ ...prev, [formId]: { loading: false } }));
    }
  }, [detailData]);

  const openCreate = () => {
    setEditingForm(null);
    setFormData({ form_code: '', name: '', description: '', is_active: true, requires_approval: true, approval_levels: 1, print_scale: DEFAULT_PRINT_SCALE, numbering_prefix: '', numbering_year_reset: true, field_definitions: [] });
    setDialogOpen(true);
  };

  const openEdit = async (form: Form) => {
    try {
      const res = await apiService.get<ApiResponse<Form>>(`/api/v1/forms/${form.id}`);
      const f = res.data;
      setEditingForm(f);
      setFormData({
        form_code: f.form_code, name: f.name, description: f.description,
        is_active: f.is_active, requires_approval: f.requires_approval,
        approval_levels: f.approval_levels,
        print_scale: f.print_scale ?? DEFAULT_PRINT_SCALE,
        numbering_prefix: f.numbering?.prefix || '',
        numbering_year_reset: f.numbering?.year_reset ?? true,
        field_definitions: (f.fields || []).map((fd: FormFieldDefinition) => ({
          field_name: fd.field_name, field_label: fd.field_label,
          field_type: fd.field_type, is_required: fd.is_required,
          validation_rules: JSON.stringify(fd.validation_rules || {}),
          options: (fd.options || []).join('\n'),
          display_order: fd.display_order,
        })),
      });
      setDialogOpen(true);
    } catch {
      enqueueSnackbar('Failed to load form details.', { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!formData.form_code.trim() || !formData.name.trim()) return;
    setFormLoading(true);
    try {
      const payload = {
        form_code: formData.form_code,
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        requires_approval: formData.requires_approval,
        approval_levels: formData.approval_levels,
        print_scale: Number(formData.print_scale) || DEFAULT_PRINT_SCALE,
        numbering_prefix: formData.numbering_prefix,
        numbering_year_reset: formData.numbering_year_reset,
        field_definitions: formData.field_definitions.map((fd, idx) => ({
          field_name: fd.field_name,
          field_label: fd.field_label,
          field_type: fd.field_type,
          is_required: fd.is_required,
          validation_rules: (() => { try { return JSON.parse(fd.validation_rules || '{}'); } catch { return {}; } })(),
          options: fd.options ? fd.options.split('\n').filter(Boolean) : null,
          display_order: fd.display_order || idx,
        })),
      };
      if (editingForm) {
        await apiService.put(`/api/v1/forms/${editingForm.id}`, payload);
      } else {
        await apiService.post('/api/v1/forms', payload);
      }
      enqueueSnackbar(editingForm ? 'Form updated.' : 'Form created.', { variant: 'success' });
      setDialogOpen(false);
      fetchForms();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      enqueueSnackbar(axiosErr?.response?.data?.error?.message || 'Failed to save form.', { variant: 'error' });
    } finally { setFormLoading(false); }
  };

  const handleToggleActive = async (form: Form) => {
    try {
      await apiService.put(`/api/v1/forms/${form.id}/toggle`);
      fetchForms();
    } catch {
      enqueueSnackbar('Failed to toggle form.', { variant: 'error' });
    }
  };

  // Open the unified assign dialog (loads current submitters & reviewers)
  const openAssignDialog = async (form: Form) => {
    setAssignTargetForm(form);
    setAssignLoading(true);
    try {
      const res = await apiService.get<ApiResponse<{ submitters: AssignedUser[]; reviewers: AssignedUser[] }>>(
        `/api/v1/forms/${form.id}/assigned-users`
      );
      setSelectedSubmitters((res.data?.submitters || []).map(u => u.id));
      setSelectedReviewers((res.data?.reviewers || []).map(u => u.id));
    } catch {
      setSelectedSubmitters([]);
      setSelectedReviewers([]);
    }
    setAssignLoading(false);
    setAssignDialogOpen(true);
  };

  const handleAssignSave = async () => {
    if (!assignTargetForm) return;
    setAssignLoading(true);
    try {
      const res = await apiService.post<ApiResponse<{ submitters_count: number; reviewers_count: number }>>(
        `/api/v1/forms/${assignTargetForm.id}/assign`,
        { submitters: selectedSubmitters, reviewers: selectedReviewers }
      );
      const { submitters_count, reviewers_count } = res.data || {};
      enqueueSnackbar(
        `Saved: ${submitters_count ?? 0} submitter(s), ${reviewers_count ?? 0} reviewer(s).`,
        { variant: 'success' }
      );
      setAssignDialogOpen(false);
      // Clear detail cache so it reloads on next expand
      setDetailData(prev => {
        const next = { ...prev };
        if (next[assignTargetForm.id]) {
          next[assignTargetForm.id] = { ...next[assignTargetForm.id], submitters: undefined, reviewers: undefined };
        }
        return next;
      });
      fetchForms();
    } catch {
      enqueueSnackbar('Failed to save assignments.', { variant: 'error' });
    } finally { setAssignLoading(false); }
  };

  const addField = () => {
    setFormData({
      ...formData,
      field_definitions: [...formData.field_definitions, {
        field_name: '', field_label: '', field_type: 'text',
        is_required: false, validation_rules: '{}', options: '',
        display_order: formData.field_definitions.length,
      }],
    });
  };

  const removeField = (idx: number) => {
    setFormData({
      ...formData,
      field_definitions: formData.field_definitions.filter((_, i) => i !== idx),
    });
  };

  const updateField = (idx: number, updates: Partial<typeof formData.field_definitions[0]>) => {
    const fields = [...formData.field_definitions];
    fields[idx] = { ...fields[idx], ...updates };
    setFormData({ ...formData, field_definitions: fields });
  };

  const columns: MRT_ColumnDef<Form>[] = [
    {
      accessorKey: 'form_code',
      header: 'Code',
      size: 100,
      Cell: ({ cell }) => <Chip label={cell.getValue<string>()} size="small" color="primary" variant="outlined" />,
    },
    { accessorKey: 'name', header: 'Name', size: 180 },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 200,
      Cell: ({ cell }) => <Typography variant="body2" color="text.secondary">{cell.getValue<string>()}</Typography>,
    },
    {
      accessorFn: (row) => row.print_scale ?? 0.94,
      id: 'print_scale',
      header: 'Print Scale',
      size: 110,
      Cell: ({ cell }) => (
        <Chip
          label={`${scaleToPercent(cell.getValue<number>())}%`}
          size="small"
          variant="outlined"
          color="info"
        />
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
      size: 70,
      Cell: ({ cell, row }) => (
        <Switch size="small" checked={!!cell.getValue<boolean>()} onChange={() => handleToggleActive(row.original)} />
      ),
    },
    {
      accessorFn: (row) => row.submission_count ?? 0,
      id: 'submission_count',
      header: 'Submissions',
      size: 90,
      muiTableHeadCellProps: { align: 'center' },
      muiTableBodyCellProps: { align: 'center' },
    },
    {
      accessorFn: (row) => row.submitters_count ?? 0,
      id: 'submitters',
      header: 'Submitters',
      size: 190,
      Cell: ({ cell, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={cell.getValue<number>()}
            size="small"
            color={cell.getValue<number>() > 0 ? 'primary' : 'default'}
            variant="outlined"
          />
          <Button
            size="small"
            variant="text"
            startIcon={<PersonAdd fontSize="small" />}
            onClick={(e) => { e.stopPropagation(); openAssignDialog(row.original); }}
            sx={{ minWidth: 'auto', textTransform: 'none', fontSize: '0.75rem' }}
          >
            Manage
          </Button>
        </Box>
      ),
    },
    {
      accessorFn: (row) => row.reviewers_count ?? 0,
      id: 'reviewers',
      header: 'Reviewers',
      size: 190,
      Cell: ({ cell, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={cell.getValue<number>()}
            size="small"
            color={cell.getValue<number>() > 0 ? 'secondary' : 'default'}
            variant="outlined"
          />
          <Button
            size="small"
            variant="text"
            startIcon={<RateReview fontSize="small" />}
            onClick={(e) => { e.stopPropagation(); openAssignDialog(row.original); }}
            sx={{ minWidth: 'auto', textTransform: 'none', fontSize: '0.75rem' }}
          >
            Manage
          </Button>
        </Box>
      ),
    },
  ];

  const table = useMaterialReactTable({
    columns,
    data: forms,
    enableRowActions: true,
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
      pagination: { pageIndex: page, pageSize: 10 },
    },
    onPaginationChange: (updater) => {
      const newState = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize: 10 })
        : updater;
      setPage(newState.pageIndex);
    },
    renderDetailPanel: ({ row }) => {
      const formId = row.original.id;
      const data = detailData[formId];
      const activeTab = detailTabs[formId] || 0;

      return (
        <Box sx={{ p: 3, bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => loadDetailData(formId, v)} sx={{ mb: 2, minHeight: 40 }}>
            <Tab label={`Submitters (${row.original.submitters_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Reviewers (${row.original.reviewers_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Fields (${row.original.fields?.length ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
          </Tabs>

          {activeTab === 0 && renderUserChips(data?.submitters, data?.loading, 'submitters')}
          {activeTab === 1 && renderUserChips(data?.reviewers, data?.loading, 'reviewers')}

          {activeTab === 2 && (
            row.original.fields && row.original.fields.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {row.original.fields.map((f, i) => (
                  <Chip
                    key={f.id || i}
                    label={`${f.field_label} (${f.field_type}${f.is_required ? ', required' : ''})`}
                    size="small"
                    variant="outlined"
                    color={f.is_required ? 'warning' : 'default'}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No fields defined.</Typography>
            )
          )}
        </Box>
      );
    },
    renderToolbarInternalActions: () => (
      <Tooltip title="Refresh">
        <IconButton onClick={fetchForms} disabled={loading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    ),
    renderRowActions: ({ row }) => (
      <Button
        size="small"
        variant="outlined"
        startIcon={<Edit fontSize="small" />}
        onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
      >
        Edit
      </Button>
    ),
    displayColumnDefOptions: {
      'mrt-row-actions': { header: 'Actions', size: 110 },
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
        title="Form Management"
        subtitle={`${total} form${total !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Forms' }]}
        actions={<Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create Form</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchForms}>Retry</Button>}>{error}</Alert>}
      {loading && !error && <LoadingSkeleton variant="table" rows={5} />}
      {!loading && !error && forms.length === 0 && <EmptyState title="No forms" description="Create your first form to get started." actionLabel="Create Form" onAction={openCreate} />}
      {!loading && !error && forms.length > 0 && (
        <MaterialReactTable table={table} />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingForm ? `Edit: ${editingForm.name}` : 'Create Form'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Form Code" value={formData.form_code} onChange={(e) => setFormData({ ...formData, form_code: e.target.value.toUpperCase() })} disabled={!!editingForm} fullWidth required helperText="Unique code, e.g. MPAI" />
            <TextField label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required />
            <TextField label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} fullWidth multiline minRows={2} />
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />} label="Active" />
              <FormControlLabel control={<Switch checked={formData.requires_approval} onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })} />} label="Requires Approval" />
            </Stack>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Default Print Scale
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1, px: 1 }}>
                  <Slider
                    value={scaleToPercent(formData.print_scale)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(_, value) => setFormData({ ...formData, print_scale: percentToScale(value as number) })}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
                <Chip
                  label={`${scaleToPercent(formData.print_scale)}%`}
                  color="info"
                  variant="outlined"
                  sx={{ minWidth: 74, justifyContent: 'center' }}
                />
              </Stack>
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>Request Numbering</Typography>
            <Stack direction="row" spacing={2}>
              <TextField label="Prefix" value={formData.numbering_prefix} onChange={(e) => setFormData({ ...formData, numbering_prefix: e.target.value })} size="small" helperText="e.g. REQ-MPAI" />
              <FormControlLabel control={<Switch checked={formData.numbering_year_reset} onChange={(e) => setFormData({ ...formData, numbering_year_reset: e.target.checked })} />} label="Year Reset" />
            </Stack>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Field Definitions</Typography>
              <Button size="small" onClick={addField} startIcon={<Add />}>Add Field</Button>
            </Box>
            {formData.field_definitions.map((field, idx) => (
              <Box key={idx} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Field Name" value={field.field_name} onChange={(e) => updateField(idx, { field_name: e.target.value })} sx={{ flex: 1 }} helperText="snake_case" />
                    <TextField size="small" label="Label" value={field.field_label} onChange={(e) => updateField(idx, { field_label: e.target.value })} sx={{ flex: 1 }} />
                    <TextField size="small" select label="Type" value={field.field_type} onChange={(e) => updateField(idx, { field_type: e.target.value })} sx={{ width: 130 }}>
                      {FIELD_TYPES.map((ft) => <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>)}
                    </TextField>
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <FormControlLabel control={<Switch size="small" checked={field.is_required} onChange={(e) => updateField(idx, { is_required: e.target.checked })} />} label="Required" />
                    <TextField size="small" label="Validation Rules (JSON)" value={field.validation_rules} onChange={(e) => updateField(idx, { validation_rules: e.target.value })} sx={{ flex: 1 }} />
                    {field.field_type === 'select' && (
                      <TextField size="small" label="Options (one per line)" value={field.options} onChange={(e) => updateField(idx, { options: e.target.value })} multiline minRows={2} sx={{ flex: 1 }} />
                    )}
                  </Stack>
                  <Button size="small" color="error" onClick={() => removeField(idx)}>Remove</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={formLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={formLoading} startIcon={formLoading ? <CircularProgress size={16} /> : undefined}>
            {editingForm ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Submitters & Reviewers Dialog — two sections */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Manage Access — {assignTargetForm?.name}
        </DialogTitle>
        <DialogContent>
          {assignLoading ? (
            <CircularProgress sx={{ mt: 2 }} />
          ) : (
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Submitters Section */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonAdd fontSize="small" color="primary" />
                  Who can submit?
                </Typography>
                <Autocomplete
                  multiple
                  options={allUsers}
                  getOptionLabel={(u) => `${u.full_name || u.username} (${u.email})`}
                  value={allUsers.filter(u => selectedSubmitters.includes(u.id))}
                  onChange={(_, vals) => setSelectedSubmitters(vals.map(v => v.id))}
                  renderInput={(params) => <TextField {...params} label="Submitters" />}
                />
              </Box>

              {/* Reviewers Section */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RateReview fontSize="small" color="secondary" />
                  Who can review?
                </Typography>
                <Autocomplete
                  multiple
                  options={allUsers}
                  getOptionLabel={(u) => `${u.full_name || u.username} (${u.email})`}
                  value={allUsers.filter(u => selectedReviewers.includes(u.id))}
                  onChange={(_, vals) => setSelectedReviewers(vals.map(v => v.id))}
                  renderInput={(params) => <TextField {...params} label="Reviewers" />}
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignSave} disabled={assignLoading}>
            Save Assignments
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Helper to render a list of user chips */
function renderUserChips(
  users: AssignedUser[] | undefined,
  loading: boolean | undefined,
  label: string,
) {
  if (loading) return <CircularProgress size={24} />;
  if (!users || users.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No {label} assigned. Click <strong>Manage</strong> in the table to add users.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {users.map(u => (
        <Chip
          key={u.id}
          avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{u.full_name?.[0] || u.username[0]}</Avatar>}
          label={`${u.full_name || u.username} (${u.email})`}
          size="small"
          variant="outlined"
        />
      ))}
    </Box>
  );
}
