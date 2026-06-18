import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, CardActions, Typography, Button, Chip,
  Alert, Skeleton, Grid, IconButton, Tooltip,
} from '@mui/material';
import { Description, Create, InfoOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import FormInstructionsDialog from '../../components/common/FormInstructionsDialog';
import { getFormComponent } from '../../forms/registry';
import { parseApiDateTime } from '../../utils/dateTime';
import type { Form, ApiResponse, PaginatedResponse, Submission } from '../../types';

export default function MyFormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoFormCode, setInfoFormCode] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get<ApiResponse<Form[]>>('/api/v1/forms');
      setForms(res.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleFillForm = useCallback(async (form: Form) => {
    try {
      const res = await apiService.get<PaginatedResponse<Submission>>('/api/v1/submissions', {
        page: 1,
        page_size: 100,
      });
      const resumableStatuses = new Set(['draft', 'needs_correction', 'rejected']);
      const existingSubmission = (res.data || [])
        .filter((submission) =>
          (submission.form?.form_code || submission.form_code) === form.form_code
          && resumableStatuses.has(submission.status),
        )
        .sort((left, right) => (parseApiDateTime(right.updated_at)?.getTime() || 0) - (parseApiDateTime(left.updated_at)?.getTime() || 0))[0];

      if (existingSubmission) {
        navigate(`/submissions/${existingSubmission.id}/edit`);
        return;
      }
    } catch {
      // Fall back to creating a new draft if lookup fails.
    }

    navigate(`/submissions/new?form_code=${encodeURIComponent(form.form_code)}`);
  }, [navigate]);

  const infoForm = infoFormCode ? getFormComponent(infoFormCode) : undefined;

  return (
    <Box>
      <PageHeader
        title="My Forms"
        subtitle={loading ? 'Loading...' : `${forms.length} form${forms.length !== 1 ? 's' : ''} available`}
        breadcrumbs={[{ label: 'My Forms' }]}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchForms}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {loading && !error && (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={200} />
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && !error && forms.length === 0 && (
        <EmptyState
          title="No forms assigned"
          description="You don't have any forms assigned for submission. Contact an administrator to get access."
        />
      )}

      {!loading && !error && forms.length > 0 && (
        <Grid container spacing={3}>
          {forms.map((form) => (
            <Grid key={form.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  transition: 'box-shadow 0.2s, transform 0.1s',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Description color="primary" sx={{ mt: 0.5 }} />
                    <Box>
                      <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                        {form.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {form.form_code}
                      </Typography>
                    </Box>
                    <Tooltip title="View instructions">
                      <IconButton size="small" sx={{ ml: 'auto' }} onClick={() => setInfoFormCode(form.form_code)}>
                        <InfoOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                    {form.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={form.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={form.is_active ? 'success' : 'default'}
                      variant="outlined"
                    />
                    {form.submission_count !== undefined && (
                      <Chip
                        label={`${form.submission_count} submission${form.submission_count !== 1 ? 's' : ''}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {form.requires_approval && (
                      <Chip label="Requires Approval" size="small" variant="outlined" color="warning" />
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Create />}
                    onClick={() => handleFillForm(form)}
                    disabled={!form.is_active}
                  >
                    Fill Form
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <FormInstructionsDialog
        open={!!infoForm}
        metadata={infoForm?.metadata || { name: '', description: '', icon: '' }}
        onClose={() => setInfoFormCode(null)}
      />
    </Box>
  );
}
