import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Paper, Typography, Alert, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, IconButton, Tooltip,
} from '@mui/material';
import { Save, Send, Check, ErrorOutlined, Delete, InfoOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiService } from '../../services/api';
import { getFormComponent } from '../../forms/registry';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormInstructionsDialog from '../../components/common/FormInstructionsDialog';
import IssueDialog from '../../components/common/IssueDialog';
import type { Submission, ApiResponse } from '../../types';
import type { FormData, ValidationErrors } from '../../types/form';

interface SaveStatus {
  state: 'idle' | 'saving' | 'saved' | 'error';
  time?: string;
}

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLoadedFormData(formCode: string, initialData: FormData, loadedData?: FormData | null): FormData {
  const mergedData = {
    ...initialData,
    ...(loadedData || {}),
  };

  if (formCode === 'MPAI' && (!mergedData.analysis_date || String(mergedData.analysis_date).trim() === '')) {
    mergedData.analysis_date = getCurrentDateString();
  }

  return mergedData;
}

export default function SubmissionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const isNew = !id || id === 'new';
  const formCodeFromUrl = searchParams.get('form_code');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formCode, setFormCode] = useState<string>('');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>([]);
  const [validationActive, setValidationActive] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [availableFormCount, setAvailableFormCount] = useState(0);
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: 'Submission Issue',
    message: '',
  });

  const hasUnsavedChanges = useRef(false);
  const currentSubmissionId = useRef<number | null>(null);
  const autoDraftInitialized = useRef(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveFormDataRef = useRef<FormData>({});

  const formComponent = useMemo(() => (formCode ? getFormComponent(formCode) : undefined), [formCode]);
  const isResubmission = submission?.status === 'needs_correction';
  const getLatestFormData = useCallback(() => liveFormDataRef.current, []);

  const openIssueDialog = useCallback((message: string, title = 'Submission Issue') => {
    setIssueDialog({ open: true, title, message });
  }, []);

  const createDraftForForm = useCallback(async (resolvedFormCode: string) => {
    if (autoDraftInitialized.current) {
      return;
    }

    autoDraftInitialized.current = true;
    const formComp = getFormComponent(resolvedFormCode);
    if (!formComp) {
      setError(`Unknown form type: ${resolvedFormCode}`);
      return;
    }

    setFormCode(resolvedFormCode);
    const initialFormData = normalizeLoadedFormData(resolvedFormCode, formComp.initialData());
    setFormData(initialFormData);
    liveFormDataRef.current = initialFormData;

    const formsRes = await apiService.get<ApiResponse<Array<{ id: number; form_code: string }>>>('/api/v1/forms');
    const matchedForm = formsRes.data?.find((form) => form.form_code === resolvedFormCode);
    if (!matchedForm) {
      setError('This form is not available or has been deactivated.');
      return;
    }

    const res = await apiService.post<ApiResponse<Submission>>('/api/v1/submissions', {
      form_id: matchedForm.id,
    });
    currentSubmissionId.current = res.data.id;
    setSubmission(res.data);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (isNew) {
          let resolvedFormCode = formCodeFromUrl;

          if (!resolvedFormCode) {
            const formsRes = await apiService.get<ApiResponse<Array<{ id: number; form_code: string; is_active?: boolean }>>>('/api/v1/forms');
            const availableForms = (formsRes.data || []).filter((form) => form.is_active !== false);
            setAvailableFormCount(availableForms.length);

            if (availableForms.length === 1) {
              resolvedFormCode = availableForms[0].form_code;
            } else if (availableForms.length > 1) {
              navigate('/my-forms', { replace: true });
              return;
            } else {
              return;
            }
          } else {
            setAvailableFormCount(1);
          }

          await createDraftForForm(resolvedFormCode);
          return;
        }

        const res = await apiService.get<ApiResponse<Submission>>(`/api/v1/submissions/${id}`);
        const sub = res.data;
        const resolvedFormCode = sub.form?.form_code || '';
        setSubmission(sub);
        setFormCode(resolvedFormCode);
        currentSubmissionId.current = sub.id;
        const resolvedFormComponent = resolvedFormCode ? getFormComponent(resolvedFormCode) : undefined;
        if (resolvedFormComponent) {
          const normalizedData = normalizeLoadedFormData(
            resolvedFormCode,
            resolvedFormComponent.initialData(),
            sub.current_version?.data as FormData | undefined,
          );
          setFormData(normalizedData);
          liveFormDataRef.current = normalizedData;
        } else if (sub.current_version?.data) {
          const loadedData = sub.current_version.data as FormData;
          setFormData(loadedData);
          liveFormDataRef.current = loadedData;
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr?.response?.data?.error?.message || 'Failed to load submission.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [createDraftForForm, formCodeFromUrl, id, isNew, navigate]);

  const doSave = useCallback(async (data: FormData) => {
    if (!currentSubmissionId.current) return;
    setSaveStatus({ state: 'saving' });
    try {
      await apiService.put(`/api/v1/submissions/${currentSubmissionId.current}`, { data });
      const now = new Date();
      setSaveStatus({ state: 'saved', time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      hasUnsavedChanges.current = false;
    } catch {
      setSaveStatus({ state: 'error' });
    }
  }, []);

  const handleFormChange = useCallback((data: FormData) => {
    liveFormDataRef.current = data;
    setFormData(data);
    hasUnsavedChanges.current = true;
    setSaveStatus({ state: 'idle' });
  }, []);

  const handleLiveFormChange = useCallback((data: FormData) => {
    liveFormDataRef.current = data;
    hasUnsavedChanges.current = true;
    setSaveStatus({ state: 'idle' });
  }, []);

  const handleBlur = useCallback((field: string) => {
    if (!validationActive) return;
    setTouched((prev) => new Set(prev).add(field));
  }, [validationActive]);

  const runValidation = useCallback(() => {
    if (!formComponent) return [];
    setValidationActive(true);
    const allFields = Object.keys(formComponent.initialData());
    setTouched(new Set(allFields));
    const errors = formComponent.validate(getLatestFormData());
    setValidationErrors(errors);
    return errors;
  }, [formComponent, getLatestFormData]);

  useEffect(() => {
    if (!validationActive || !formComponent) return;
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }
    validationTimerRef.current = setTimeout(() => {
      setValidationErrors(formComponent.validate(getLatestFormData()));
      validationTimerRef.current = null;
    }, 180);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
        validationTimerRef.current = null;
      }
    };
  }, [validationActive, formComponent, formData, getLatestFormData]);

  const handleSubmitClick = () => {
    const errors = runValidation();
    if (errors.length > 0) {
      openIssueDialog(
        `Please fix ${errors.length} validation error${errors.length > 1 ? 's' : ''} before submitting.`,
        'Validation Required',
      );
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const latestFormData = getLatestFormData();
      setFormData(latestFormData);
      await apiService.put(`/api/v1/submissions/${currentSubmissionId.current}`, { data: latestFormData });
      await apiService.post(
        `/api/v1/submissions/${currentSubmissionId.current}/workflow/${isResubmission ? 'resubmit' : 'submit'}`,
        {},
      );
      enqueueSnackbar(isResubmission ? 'Submission resubmitted for review!' : 'Submission sent for review!', { variant: 'success' });
      hasUnsavedChanges.current = false;
      navigate(`/submissions/${currentSubmissionId.current}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      openIssueDialog(axiosErr?.response?.data?.error?.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!currentSubmissionId.current) return;
    setDeleteLoading(true);
    try {
      await apiService.delete(`/api/v1/submissions/${currentSubmissionId.current}`);
      hasUnsavedChanges.current = false;
      setDeleteOpen(false);
      navigate('/submissions');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      openIssueDialog(axiosErr?.response?.data?.error?.message || 'Failed to delete draft.');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  if (loading) {
    return (
      <Box>
        <PageHeader title="Submission" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Edit' }]} />
        <LoadingSkeleton variant="detail" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <PageHeader title="Error" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Edit' }]} />
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/submissions')}>Back to Submissions</Button>
      </Box>
    );
  }

  if (isNew && !submission) {
    return (
      <Box>
        <PageHeader
          title="New Submission"
          breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'New' }]}
        />
        <EmptyState
          title={availableFormCount === 0 ? 'No forms assigned' : 'Open from My Forms'}
          description={availableFormCount === 0
            ? 'You do not currently have any active form assigned for submission.'
            : 'Start a submission from My Forms. The old generic form picker has been removed.'}
          actionLabel="Go To My Forms"
          onAction={() => navigate('/my-forms')}
        />
      </Box>
    );
  }

  if (!formComponent) {
    return (
      <Box>
        <PageHeader title="Unknown Form" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Edit' }]} />
        <EmptyState title="Form type not found" description="The form associated with this submission is not available." />
      </Box>
    );
  }

  const FormEdit = formComponent.FormEdit;
  const fieldErrors = validationErrors.filter((e) => e.field !== '_form');
  const formWideErrors = validationErrors.filter((e) => e.field === '_form');

  return (
    <Box>
      <PageHeader
        title={submission?.request_number || 'New Submission'}
        subtitle={formComponent.metadata.name}
        breadcrumbs={[
          { label: 'Submissions', href: '/submissions' },
          { label: submission?.request_number || 'New' },
        ]}
        actions={(
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="View form instructions">
              <IconButton onClick={() => setInstructionsOpen(true)}>
                <InfoOutlined />
              </IconButton>
            </Tooltip>
            {saveStatus.state !== 'idle' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {saveStatus.state === 'saving' && <CircularProgress size={14} />}
                {saveStatus.state === 'saved' && <Check fontSize="small" color="success" />}
                {saveStatus.state === 'error' && <ErrorOutlined fontSize="small" color="error" />}
                <Typography variant="caption" color={saveStatus.state === 'error' ? 'error' : 'text.secondary'}>
                  {saveStatus.state === 'saving'
                    ? 'Saving...'
                    : saveStatus.state === 'saved'
                      ? `Saved at ${saveStatus.time}`
                      : 'Save failed'}
                </Typography>
              </Box>
            )}
            <Button variant="outlined" startIcon={<Save />} onClick={() => doSave(getLatestFormData())}>
              Save Draft
            </Button>
            {submission?.status === 'draft' && (
              <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => setDeleteOpen(true)}>
                Delete Draft
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
              onClick={handleSubmitClick}
              disabled={submitting || saveStatus.state === 'saving'}
            >
              {isResubmission ? 'Resubmit for Review' : 'Submit for Review'}
            </Button>
          </Box>
        )}
      />

      {formWideErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {formWideErrors.map((e, i) => (
            <Typography key={i} variant="body2">{e.message}</Typography>
          ))}
        </Alert>
      )}

      {fieldErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Please fix the following errors:
          </Typography>
          {fieldErrors.map((e) => (
            <Typography key={e.field} variant="body2">
              - {e.message}
            </Typography>
          ))}
        </Alert>
      )}

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <FormEdit
          data={formData}
          onChange={handleFormChange}
          onLiveChange={handleLiveFormChange}
          errors={validationErrors}
          onBlur={handleBlur}
          touched={touched}
        />
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isResubmission ? 'Resubmit for Review' : 'Submit for Review'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isResubmission
              ? 'Are you sure you want to resubmit this form for review? You will not be able to edit it again unless more changes are requested.'
              : 'Are you sure you want to submit this form for review? You will not be able to edit it after submission.'}
          </DialogContentText>
          <Box sx={{ mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Form: {formComponent.metadata.name}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <Send />}
          >
            {isResubmission ? 'Resubmit' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Draft"
        message="Delete this draft? This will remove the unfinished submission and its temporary draft identifier."
        confirmLabel="Delete Draft"
        confirmColor="error"
        loading={deleteLoading}
        onConfirm={handleDeleteDraft}
        onCancel={() => setDeleteOpen(false)}
      />

      <FormInstructionsDialog
        open={instructionsOpen}
        metadata={formComponent.metadata}
        onClose={() => setInstructionsOpen(false)}
      />

      <IssueDialog
        open={issueDialog.open}
        title={issueDialog.title}
        message={issueDialog.message}
        onClose={() => setIssueDialog((current) => ({ ...current, open: false }))}
      />
    </Box>
  );
}
