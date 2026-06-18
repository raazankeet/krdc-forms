import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Chip, IconButton, Tooltip, Alert, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Stack, MenuItem, FormControlLabel, Tabs, Tab, Slider,
  Avatar, Autocomplete,
} from '@mui/material';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Add, Edit, Refresh, PersonAdd, RateReview, VerifiedUser, Settings } from '@mui/icons-material';
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

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetForm, setAssignTargetForm] = useState<Form | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedSubmitters, setSelectedSubmitters] = useState<number[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<number[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const [detailTabs, setDetailTabs] = useState<Record<number, number>>({});
  const [detailData, setDetailData] = useState<Record<number, {
    submitters?: AssignedUser[];
    reviewers?: AssignedUser[];
    approvers?: AssignedUser[];
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
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await apiService.get<ApiResponse<User[]>>('/api/v1/users', { page_size: 100 });
      setAllUsers(res.data || []);
    } catch {
      // Non-blocking.
    }
  }, []);

  useEffect(() => {
    fetchForms();
    fetchAllUsers();
  }, [fetchForms, fetchAllUsers]);

  const loadDetailData = useCallback(async (formId: number, tabIndex: number) => {
    setDetailTabs((prev) => ({ ...prev, [formId]: tabIndex }));
    const current = detailData[formId];
    const needsFetch = (tabIndex === 0 || tabIndex === 1 || tabIndex === 2)
      && (!current?.submitters || !current?.reviewers || !current?.approvers);
    if (!needsFetch) return;

    setDetailData((prev) => ({ ...prev, [formId]: { ...prev[formId], loading: true } }));
    try {
      const res = await apiService.get<ApiResponse<{ submitters: AssignedUser[]; reviewers: AssignedUser[]; approvers: AssignedUser[] }>>(
        `/api/v1/forms/${formId}/assigned-users`,
      );
      setDetailData((prev) => ({
        ...prev,
        [formId]: {
          submitters: res.data?.submitters || [],
          reviewers: res.data?.reviewers || [],
          approvers: res.data?.approvers || [],
          loading: false,
        },
      }));
    } catch {
      setDetailData((prev) => ({ ...prev, [formId]: { ...prev[formId], loading: false } }));
    }
  }, [detailData]);

  const openCreate = () => {
    setEditingForm(null);
    setFormData({
      form_code: '',
      name: '',
      description: '',
      is_active: true,
      requires_approval: true,
      approval_levels: 1,
      print_scale: DEFAULT_PRINT_SCALE,
      numbering_prefix: '',
      numbering_year_reset: true,
      field_definitions: [],
    });
    setDialogOpen(true);
  };

  const openEdit = async (form: Form) => {
    try {
      const res = await apiService.get<ApiResponse<Form>>(`/api/v1/forms/${form.id}`);
      const loadedForm = res.data;
      setEditingForm(loadedForm);
      setFormData({
        form_code: loadedForm.form_code,
        name: loadedForm.name,
        description: loadedForm.description,
        is_active: loadedForm.is_active,
        requires_approval: loadedForm.requires_approval,
        approval_levels: loadedForm.approval_levels,
        print_scale: loadedForm.print_scale ?? DEFAULT_PRINT_SCALE,
        numbering_prefix: loadedForm.numbering?.prefix || '',
        numbering_year_reset: loadedForm.numbering?.year_reset ?? true,
        field_definitions: (loadedForm.fields || []).map((field: FormFieldDefinition) => ({
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          is_required: field.is_required,
          validation_rules: JSON.stringify(field.validation_rules || {}),
          options: (field.options || []).join('\n'),
          display_order: field.display_order,
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
        field_definitions: formData.field_definitions.map((field, idx) => ({
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          is_required: field.is_required,
          validation_rules: (() => {
            try {
              return JSON.parse(field.validation_rules || '{}');
            } catch {
              return {};
            }
          })(),
          options: field.options ? field.options.split('\n').filter(Boolean) : null,
          display_order: field.display_order || idx,
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
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (form: Form) => {
    try {
      await apiService.put(`/api/v1/forms/${form.id}/toggle`);
      fetchForms();
    } catch {
      enqueueSnackbar('Failed to toggle form.', { variant: 'error' });
    }
  };

  const openAssignDialog = async (form: Form) => {
    setAssignTargetForm(form);
    setAssignLoading(true);
    try {
      const res = await apiService.get<ApiResponse<{ submitters: AssignedUser[]; reviewers: AssignedUser[]; approvers: AssignedUser[] }>>(
        `/api/v1/forms/${form.id}/assigned-users`,
      );
      setSelectedSubmitters((res.data?.submitters || []).map((user) => user.id));
      setSelectedReviewers((res.data?.reviewers || []).map((user) => user.id));
      setSelectedApprovers((res.data?.approvers || []).map((user) => user.id));
    } catch {
      setSelectedSubmitters([]);
      setSelectedReviewers([]);
      setSelectedApprovers([]);
    }
    setAssignLoading(false);
    setAssignDialogOpen(true);
  };

  const handleAssignSave = async () => {
    if (!assignTargetForm) return;
    setAssignLoading(true);
    try {
      const res = await apiService.post<ApiResponse<{ submitters_count: number; reviewers_count: number; approvers_count: number }>>(
        `/api/v1/forms/${assignTargetForm.id}/assign`,
        {
          submitters: selectedSubmitters,
          reviewers: selectedReviewers,
          approvers: selectedApprovers,
        },
      );
      const { submitters_count, reviewers_count, approvers_count } = res.data || {};
      enqueueSnackbar(
        `Saved: ${submitters_count ?? 0} submitter(s), ${reviewers_count ?? 0} reviewer(s), ${approvers_count ?? 0} approver(s).`,
        { variant: 'success' },
      );
      setAssignDialogOpen(false);
      setDetailData((prev) => {
        const next = { ...prev };
        if (next[assignTargetForm.id]) {
          next[assignTargetForm.id] = {
            ...next[assignTargetForm.id],
            submitters: undefined,
            reviewers: undefined,
            approvers: undefined,
          };
        }
        return next;
      });
      fetchForms();
    } catch {
      enqueueSnackbar('Failed to save assignments.', { variant: 'error' });
    } finally {
      setAssignLoading(false);
    }
  };

  const addField = () => {
    setFormData((prev) => ({
      ...prev,
      field_definitions: [
        ...prev.field_definitions,
        {
          field_name: '',
          field_label: '',
          field_type: 'text',
          is_required: false,
          validation_rules: '{}',
          options: '',
          display_order: prev.field_definitions.length,
        },
      ],
    }));
  };

  const removeField = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      field_definitions: prev.field_definitions.filter((_, index) => index !== idx),
    }));
  };

  const updateField = (idx: number, updates: Partial<typeof formData.field_definitions[0]>) => {
    const fields = [...formData.field_definitions];
    fields[idx] = { ...fields[idx], ...updates };
    setFormData((prev) => ({ ...prev, field_definitions: fields }));
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
      accessorFn: (row) => row.print_scale ?? DEFAULT_PRINT_SCALE,
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
      accessorFn: (row) => ({
        submitters: row.submitters_count ?? 0,
        reviewers: row.reviewers_count ?? 0,
        approvers: row.approvers_count ?? 0,
      }),
      id: 'workflow_access',
      header: 'Workflow Access',
      size: 320,
      Cell: ({ row }) => (
        <WorkflowAccessCell
          submitters={row.original.submitters_count ?? 0}
          reviewers={row.original.reviewers_count ?? 0}
          approvers={row.original.approvers_count ?? 0}
          onManage={() => openAssignDialog(row.original)}
        />
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
          <Tabs value={activeTab} onChange={(_, value) => loadDetailData(formId, value)} sx={{ mb: 2, minHeight: 40 }}>
            <Tab label={`Submitters (${row.original.submitters_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Reviewers (${row.original.reviewers_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Approvers (${row.original.approvers_count ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Fields (${row.original.fields?.length ?? 0})`} sx={{ minHeight: 40, textTransform: 'none' }} />
          </Tabs>

          {activeTab === 0 && renderUserChips(data?.submitters, data?.loading, 'submitters')}
          {activeTab === 1 && renderUserChips(data?.reviewers, data?.loading, 'reviewers')}
          {activeTab === 2 && renderUserChips(data?.approvers, data?.loading, 'approvers')}
          {activeTab === 3 && (
            row.original.fields && row.original.fields.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {row.original.fields.map((field, index) => (
                  <Chip
                    key={field.id || index}
                    label={`${field.field_label} (${field.field_type}${field.is_required ? ', required' : ''})`}
                    size="small"
                    variant="outlined"
                    color={field.is_required ? 'warning' : 'default'}
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
        onClick={(event) => {
          event.stopPropagation();
          openEdit(row.original);
        }}
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
      {!loading && !error && forms.length === 0 && (
        <EmptyState title="No forms" description="Create your first form to get started." actionLabel="Create Form" onAction={openCreate} />
      )}
      {!loading && !error && forms.length > 0 && <MaterialReactTable table={table} />}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingForm ? `Edit: ${editingForm.name}` : 'Create Form'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Form Code" value={formData.form_code} onChange={(event) => setFormData({ ...formData, form_code: event.target.value.toUpperCase() })} disabled={!!editingForm} fullWidth required helperText="Unique code, e.g. MPAI" />
            <TextField label="Name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} fullWidth required />
            <TextField label="Description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} fullWidth multiline minRows={2} />
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={formData.is_active} onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })} />} label="Active" />
              <FormControlLabel control={<Switch checked={formData.requires_approval} onChange={(event) => setFormData({ ...formData, requires_approval: event.target.checked })} />} label="Requires Approval" />
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
              <TextField label="Prefix" value={formData.numbering_prefix} onChange={(event) => setFormData({ ...formData, numbering_prefix: event.target.value })} size="small" helperText="e.g. REQ-MPAI" />
              <FormControlLabel control={<Switch checked={formData.numbering_year_reset} onChange={(event) => setFormData({ ...formData, numbering_year_reset: event.target.checked })} />} label="Year Reset" />
            </Stack>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Field Definitions</Typography>
              <Button size="small" onClick={addField} startIcon={<Add />}>Add Field</Button>
            </Box>
            {formData.field_definitions.map((field, idx) => (
              <Box key={idx} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Field Name" value={field.field_name} onChange={(event) => updateField(idx, { field_name: event.target.value })} sx={{ flex: 1 }} helperText="snake_case" />
                    <TextField size="small" label="Label" value={field.field_label} onChange={(event) => updateField(idx, { field_label: event.target.value })} sx={{ flex: 1 }} />
                    <TextField size="small" select label="Type" value={field.field_type} onChange={(event) => updateField(idx, { field_type: event.target.value })} sx={{ width: 130 }}>
                      {FIELD_TYPES.map((fieldType) => <MenuItem key={fieldType.value} value={fieldType.value}>{fieldType.label}</MenuItem>)}
                    </TextField>
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <FormControlLabel control={<Switch size="small" checked={field.is_required} onChange={(event) => updateField(idx, { is_required: event.target.checked })} />} label="Required" />
                    <TextField size="small" label="Validation Rules (JSON)" value={field.validation_rules} onChange={(event) => updateField(idx, { validation_rules: event.target.value })} sx={{ flex: 1 }} />
                    {field.field_type === 'select' && (
                      <TextField size="small" label="Options (one per line)" value={field.options} onChange={(event) => updateField(idx, { options: event.target.value })} multiline minRows={2} sx={{ flex: 1 }} />
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

      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Manage Workflow Access - {assignTargetForm?.name}</DialogTitle>
        <DialogContent>
          {assignLoading ? (
            <CircularProgress sx={{ mt: 2 }} />
          ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <AccessSummaryCard
                  title="Submitters"
                  description="Create, edit draft, submit, and resubmit."
                  count={selectedSubmitters.length}
                  color="primary"
                  icon={<PersonAdd fontSize="small" />}
                />
                <AccessSummaryCard
                  title="Reviewers"
                  description="First review stage before approval."
                  count={selectedReviewers.length}
                  color="secondary"
                  icon={<RateReview fontSize="small" />}
                />
                <AccessSummaryCard
                  title="Approvers"
                  description="Final decision stage with approve or return."
                  count={selectedApprovers.length}
                  color="success"
                  icon={<VerifiedUser fontSize="small" />}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonAdd fontSize="small" color="primary" />
                  Submitters
                </Typography>
                <Autocomplete
                  multiple
                  options={allUsers}
                  getOptionLabel={(user) => `${user.full_name || user.username} (${user.email})`}
                  value={allUsers.filter((user) => selectedSubmitters.includes(user.id))}
                  onChange={(_, values) => setSelectedSubmitters(values.map((value) => value.id))}
                  renderInput={(params) => <TextField {...params} label="Submitters" />}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RateReview fontSize="small" color="secondary" />
                  Reviewers
                </Typography>
                <Autocomplete
                  multiple
                  options={allUsers}
                  getOptionLabel={(user) => `${user.full_name || user.username} (${user.email})`}
                  value={allUsers.filter((user) => selectedReviewers.includes(user.id))}
                  onChange={(_, values) => setSelectedReviewers(values.map((value) => value.id))}
                  renderInput={(params) => <TextField {...params} label="Reviewers" />}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <VerifiedUser fontSize="small" color="success" />
                  Approvers
                </Typography>
                <Autocomplete
                  multiple
                  options={allUsers}
                  getOptionLabel={(user) => `${user.full_name || user.username} (${user.email})`}
                  value={allUsers.filter((user) => selectedApprovers.includes(user.id))}
                  onChange={(_, values) => setSelectedApprovers(values.map((value) => value.id))}
                  renderInput={(params) => <TextField {...params} label="Approvers" />}
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

function WorkflowAccessCell({
  submitters,
  reviewers,
  approvers,
  onManage,
}: {
  submitters: number;
  reviewers: number;
  approvers: number;
  onManage: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        py: 0.25,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
        <Chip
          label={`S ${submitters}`}
          size="small"
          color={submitters > 0 ? 'primary' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, borderRadius: 999 }}
        />
        <Chip
          label={`R ${reviewers}`}
          size="small"
          color={reviewers > 0 ? 'secondary' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, borderRadius: 999 }}
        />
        <Chip
          label={`A ${approvers}`}
          size="small"
          color={approvers > 0 ? 'success' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, borderRadius: 999 }}
        />
      </Box>
      <Button
        size="small"
        variant="text"
        startIcon={<Settings fontSize="small" />}
        onClick={(event) => {
          event.stopPropagation();
          onManage();
        }}
        sx={{
          px: 0.5,
          minWidth: 'auto',
          whiteSpace: 'nowrap',
          textTransform: 'none',
          fontSize: '0.78rem',
          fontWeight: 700,
          borderRadius: 2,
        }}
      >
        Manage Access
      </Button>
    </Box>
  );
}

function AccessSummaryCard({
  title,
  description,
  count,
  color,
  icon,
}: {
  title: string;
  description: string;
  count: number;
  color: 'primary' | 'secondary' | 'success';
  icon: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Box sx={{ color: `${color}.main`, display: 'inline-flex' }}>
          {icon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Chip
          label={count}
          size="small"
          color={count > 0 ? color : 'default'}
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

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
      {users.map((user) => (
        <Chip
          key={user.id}
          avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{user.full_name?.[0] || user.username[0]}</Avatar>}
          label={`${user.full_name || user.username} (${user.email})`}
          size="small"
          variant="outlined"
        />
      ))}
    </Box>
  );
}
