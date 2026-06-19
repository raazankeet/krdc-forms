import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Slider,
  Stack,
  TextField,
  CircularProgress,
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { apiService } from '../../services/api';
import { getFormComponent } from '../../forms/registry';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { parseApiDateTime } from '../../utils/dateTime';
import type { ApiResponse, Submission } from '../../types';

const DEFAULT_PRINT_SCALE = 0.94;
const MIN_PRINT_SCALE = 0;
const MAX_PRINT_SCALE = 1;
const PRINT_SCALE_STEP = 0.01;
const MIN_PRINT_PERCENT = 0;
const MAX_PRINT_PERCENT = 100;
const PRINT_PERCENT_STEP = 1;
const MPAI_SHEET_WIDTH = 980;
const A4_PRINTABLE_WIDTH_PX = 718;
const MAX_A4_SAFE_SCALE = A4_PRINTABLE_WIDTH_PX / MPAI_SHEET_WIDTH;

function scaleToPercent(scale: number) {
  return Math.round(scale * 100);
}

function percentToScale(percent: number) {
  const normalized = Number.isFinite(percent) ? percent / 100 : DEFAULT_PRINT_SCALE;
  return Math.min(MAX_PRINT_SCALE, Math.max(MIN_PRINT_SCALE, normalized));
}

interface PrintData {
  request_number: string;
  form_name: string;
  form_code?: string;
  form_print_scale?: number;
  submitted_by: string;
  submitted_at: string | null;
  status: string;
  version_number: number;
  field_data: Record<string, unknown>;
  approval_chain: Array<{
    name?: string;
    user?: string;
    action: string;
    date?: string | null;
    timestamp?: string | null;
  }>;
  audit_reference: string | null;
  printed_at: string | null;
}

function formatDateValue(value?: string | null, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '-';
  const parsed = parseApiDateTime(value);
  return isValid(parsed) ? format(parsed, pattern) : '-';
}

function getReviewerByName(submission: Submission | null): string {
  if (!submission?.workflow_actions) return '';
  const reviewCompletionAction = [...submission.workflow_actions]
    .reverse()
    .find((action) => action.from_status === 'submitted' && action.action !== 'submit' && action.action !== 'resubmit');
  return reviewCompletionAction?.user?.full_name || '';
}

function getApproverByName(submission: Submission | null): string {
  if (!submission?.workflow_actions) return '';
  const approvalAction = [...submission.workflow_actions]
    .reverse()
    .find((action) => action.from_status === 'under_review' && action.user?.full_name);
  return approvalAction?.user?.full_name || '';
}

export default function PrintPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scaleSaveError, setScaleSaveError] = useState('');
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [printScale, setPrintScale] = useState(DEFAULT_PRINT_SCALE);
  const [savingScale, setSavingScale] = useState(false);

  const isAdmin = user?.roles.some((role) => role.name === 'Administrator');

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printData?.request_number || 'Submission',
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      html, body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `,
  });

  const fetchPrintData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [printRes, subRes] = await Promise.all([
        apiService.get<ApiResponse<PrintData>>(`/api/v1/submissions/${id}/print/data`),
        apiService.get<ApiResponse<Submission>>(`/api/v1/submissions/${id}`),
      ]);
      setPrintData(printRes.data);
      setSubmission(subRes.data);
      const serverPrintScale = printRes.data?.form_print_scale ?? subRes.data?.form?.print_scale ?? DEFAULT_PRINT_SCALE;
      setPrintScale(Math.min(MAX_PRINT_SCALE, Math.max(MIN_PRINT_SCALE, serverPrintScale)));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Failed to load print data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrintData();
  }, [fetchPrintData]);

  const formComponent = submission?.form?.form_code ? getFormComponent(submission.form.form_code) : undefined;
  const FormView = formComponent?.FormView;
  const formTypeLabel = printData?.form_code || submission?.form?.form_code || printData?.form_name || submission?.form?.name || '-';
  const persistedPrintScale = printData?.form_print_scale ?? submission?.form?.print_scale ?? DEFAULT_PRINT_SCALE;
  const clampedPersistedPrintScale = Math.min(MAX_PRINT_SCALE, Math.max(MIN_PRINT_SCALE, persistedPrintScale));
  const hasPendingScaleChange = Math.abs(printScale - clampedPersistedPrintScale) >= 0.005;
  const effectivePrintScale = Math.min(printScale, MAX_A4_SAFE_SCALE);
  const baseFormData = submission?.current_version?.data || {};
  const formData = printData?.form_code === 'MPAI'
    ? {
        ...baseFormData,
        calculated_by: printData.submitted_by || baseFormData.calculated_by || '',
        checked_by: getReviewerByName(submission) || baseFormData.checked_by || '',
      }
    : baseFormData;
  const reviewerName = getReviewerByName(submission) || '-';
  const approverName = getApproverByName(submission) || '-';

  const handleSavePrintScale = useCallback(async () => {
    if (!submission?.form?.id) return;
    setSavingScale(true);
    setScaleSaveError('');
    try {
      const nextScale = Math.min(MAX_PRINT_SCALE, Math.max(MIN_PRINT_SCALE, printScale));
      await apiService.put(`/api/v1/forms/${submission.form.id}`, {
        print_scale: Number(nextScale.toFixed(2)),
      });
      setPrintData((current) => current ? { ...current, form_print_scale: Number(nextScale.toFixed(2)) } : current);
      setSubmission((current) => current?.form
        ? { ...current, form: { ...current.form, print_scale: Number(nextScale.toFixed(2)) } }
        : current);
    } catch {
      setScaleSaveError('Failed to save print scale.');
    } finally {
      setSavingScale(false);
    }
  }, [printScale, submission]);

  if (loading) {
    return (
      <Box>
        <PageHeader title="Print Preview" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Print' }]} />
        <LoadingSkeleton variant="detail" />
      </Box>
    );
  }

  if (error || !printData) {
    return (
      <Box>
        <PageHeader title="Print Preview" breadcrumbs={[{ label: 'Submissions', href: '/submissions' }, { label: 'Print' }]} />
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Print data not available.'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Go Back</Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={`Print: ${printData.request_number}`}
        subtitle={formTypeLabel}
        breadcrumbs={[
          { label: 'Submissions', href: '/submissions' },
          { label: printData.request_number, href: `/submissions/${id}` },
          { label: 'Print' },
        ]}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(`/submissions/${id}`)}>
              Back
            </Button>
            <Button variant="contained" startIcon={<Print />} onClick={() => handlePrint()}>
              Print
            </Button>
          </Box>
        }
      />

      {isAdmin && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            maxWidth: 1220,
            mx: 'auto',
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Stack spacing={1.5}>
            {scaleSaveError && <Alert severity="error">{scaleSaveError}</Alert>}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Box sx={{ minWidth: 210 }}>
                <Typography variant="subtitle2">Print Scale</Typography>
                <Typography variant="body2" color="text.secondary">
                  This value is saved in the database as form metadata and used as the default print scale.
                </Typography>
              </Box>
              <Box sx={{ flex: 1, px: { md: 1 } }}>
                <Slider
                  value={scaleToPercent(printScale)}
                  min={MIN_PRINT_PERCENT}
                  max={MAX_PRINT_PERCENT}
                  step={PRINT_PERCENT_STEP}
                  onChange={(_, value) => setPrintScale(percentToScale(value as number))}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                />
              </Box>
              <TextField
                size="small"
                label="Scale"
                type="number"
                value={scaleToPercent(printScale)}
                onChange={(event) => {
                  const parsedValue = Number(event.target.value);
                  if (!Number.isFinite(parsedValue)) return;
                  setPrintScale(percentToScale(parsedValue));
                }}
                InputProps={{
                  endAdornment: <Typography variant="body2" color="text.secondary">%</Typography>,
                }}
                slotProps={{
                  htmlInput: {
                    min: MIN_PRINT_PERCENT,
                    max: MAX_PRINT_PERCENT,
                    step: PRINT_PERCENT_STEP,
                  },
                }}
                sx={{ width: 110 }}
              />
              <Button variant="outlined" onClick={() => setPrintScale(clampedPersistedPrintScale)}>
                Revert
              </Button>
              <Button variant="outlined" onClick={() => setPrintScale(DEFAULT_PRINT_SCALE)}>
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={handleSavePrintScale}
                disabled={savingScale || !hasPendingScaleChange || !submission?.form?.id}
                startIcon={savingScale ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Save Default
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Box ref={printRef}>
        <Box
          sx={{
            maxWidth: 1220,
            mx: 'auto',
            '@media print': {
              maxWidth: '100%',
              mx: 0,
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 96px',
              alignItems: 'center',
              mb: 2.5,
              pb: 1.5,
              borderBottom: '2px solid',
              borderColor: 'primary.main',
            }}
          >
            <Box sx={{ textAlign: 'center', pl: 10 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
                GLP Forms - KRDC
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Form Management Platform
              </Typography>
            </Box>
            <Box
              component="img"
              src="/crystal_logo.png"
              alt="Crystal logo"
              sx={{
                width: 76,
                height: 76,
                objectFit: 'contain',
                justifySelf: 'end',
              }}
            />
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 1.25,
              mb: 2,
              borderRadius: 2,
              maxWidth: 1080,
              mx: 'auto',
              '@media print': {
                p: 1,
                mb: 1.5,
              },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(0, 1fr))' },
                columnGap: 1.5,
                rowGap: 0.85,
                '@media print': {
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  columnGap: 1.25,
                  rowGap: 0.6,
                },
              }}
            >
              <MetaItem label="Request Number" value={printData.request_number} mono />
              <MetaItem label="Submitted By" value={printData.submitted_by} />
              <MetaItem label="Reviewed By" value={reviewerName} />
              <MetaItem label="Approved By" value={approverName} />
              <MetaItem label="Form Type" value={formTypeLabel} />
              <MetaItem label="Submitted Date" value={formatDateValue(printData.submitted_at, 'dd/MM/yyyy')} />
              <MetaItem label="Version" value={`v${printData.version_number}`} />
              <MetaItem label="Printed At" value={formatDateValue(printData.printed_at, 'dd/MM/yyyy h:mm a')} />
            </Box>
          </Paper>

          {FormView && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                borderRadius: 2,
                '@media print': {
                  p: 0,
                  border: 'none',
                  boxShadow: 'none',
                  breakInside: 'avoid-page',
                },
              }}
            >
              <Box
                sx={{
                  overflowX: 'auto',
                  '@media print': {
                    overflow: 'visible',
                  },
                }}
              >
                <Box
                  sx={{
                    width: `${MPAI_SHEET_WIDTH * effectivePrintScale}px`,
                    mx: 'auto',
                    '@media print': {
                      width: '100%',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: MPAI_SHEET_WIDTH,
                      zoom: effectivePrintScale,
                      '@media print': {
                        width: '100%',
                        zoom: 1,
                      },
                    }}
                  >
                    <FormView data={formData} readOnly printScale={effectivePrintScale} />
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          mb: 0.1,
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          lineHeight: 1,
          fontSize: '0.68rem',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={
          mono
            ? {
              fontFamily: 'monospace',
              fontWeight: 700,
              lineHeight: 1.08,
              fontSize: '0.84rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }
            : {
              fontWeight: 700,
              lineHeight: 1.08,
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }
        }
      >
        {value}
      </Typography>
    </Box>
  );
}
