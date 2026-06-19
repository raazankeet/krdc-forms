import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  AdminPanelSettings,
  CheckCircle,
  Description,
  Drafts,
  ExpandMore,
  FactCheck,
  HourglassEmpty,
  PendingActions,
  QueryStats,
  RateReview,
  Schedule,
  Send,
  Storage,
  WarningAmber,
  Visibility,
  Sync,
} from '@mui/icons-material';
import type { ReactElement } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import type { AdminDashboardStats, ReviewerDashboardStats, UserDashboardStats } from '../../types';

interface StatCard {
  title: string;
  value: string | number;
  icon: ReactElement;
  color: string;
  bgcolor: string;
}

function formatLocalDateTime(value?: string | null) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-';
  if (value <= 0) return '0 min';

  const totalMinutes = Math.round(value * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

/** Resolve a MUI theme color token (e.g. 'primary.main') to a raw CSS color string.
 *  If the value is already a raw color (starts with # or rgb/hsl), returns it as-is. */
function resolveColor(theme: any, token: string): string {
  if (token.startsWith('#') || token.startsWith('rgb') || token.startsWith('hsl')) {
    return token;
  }
  const parts = token.split('.');
  let result: any = theme.palette;
  for (const part of parts) {
    result = result?.[part];
  }
  return typeof result === 'string' ? result : token;
}

function CompactStatCard({ card, index }: { card: StatCard; index: number }) {
  const theme = useTheme();
  const resolvedColor = resolveColor(theme, card.color);
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      variant="outlined"
      sx={{
        p: 1.4,
        borderRadius: 1, // Sharp rectangle matching screenshot
        height: '100%',
        bgcolor: isDark ? 'background.paper' : '#ffffff',
        borderColor: isDark ? 'divider' : '#e0e0e0',
        borderLeft: `3px solid ${resolvedColor}`, // Thin color bar on the left
        animation: `fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) ${index * 0.08}s both`,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? '0 4px 12px rgba(0,0,0,0.3)'
            : '0 4px 12px rgba(0,0,0,0.05)',
        },
      }}
    >
      <Stack spacing={1.1} sx={{ height: '100%' }}>
        {/* Top Row: Title (Left) and Icon (Right) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', pr: 1, lineHeight: 1.2 }}>
            {card.title}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: resolvedColor,
              flexShrink: 0,
              '& svg': { fontSize: '1.5rem' }
            }}
          >
            {card.icon}
          </Box>
        </Box>
        
        {/* Bottom Row: Large Centered Number */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, pb: 0.25 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: resolvedColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {card.value}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function InsightSection({
  title,
  icon,
  rows,
  bordered,
}: {
  title: string;
  icon: ReactElement;
  rows: Array<{ label: string; value: ReactElement | string | number }>;
  bordered?: boolean;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        pl: bordered ? { xs: 0, lg: 2.5 } : 0,
        borderLeft: bordered ? { xs: 'none', lg: '1px solid' } : 'none',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>

      <Grid container spacing={1.5}>
        {rows.map((row, idx) => {
          const isLongValue = typeof row.value === 'string' && row.value.length > 18;
          const isLongLabel = row.label.length > 20;
          const shouldSpanWide = isLongValue || isLongLabel;

          return (
          <Grid size={{ xs: 12, sm: shouldSpanWide ? 12 : 6, lg: shouldSpanWide ? 12 : 4 }} key={row.label}>
            <Card
              variant="outlined"
              sx={(theme) => ({
                p: 1.25,
                pl: 1.75,
                borderRadius: 2.5,
                borderColor: theme.palette.divider,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'none',
                height: '100%',
                bgcolor: theme.palette.background.paper,
                backgroundImage: 'none',
                animation: `fadeInUp 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 0.04}s both`,
                transition: 'border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: '0 3px 3px 0',
                  backgroundColor: theme.palette.primary.light,
                },
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 4px 14px rgba(0,0,0,0.3)'
                    : '0 4px 14px rgba(0,0,0,0.06)',
                  transform: 'translateY(-1px)',
                },
              })}
            >
              {typeof row.value === 'string' || typeof row.value === 'number' ? (
                <Stack spacing={0.6} sx={{ minHeight: shouldSpanWide ? 56 : 44 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      lineHeight: 1.2,
                      whiteSpace: 'normal',
                    }}
                  >
                    {row.label}
                  </Typography>
                  <Typography
                    variant={shouldSpanWide ? 'body1' : 'h6'}
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.15,
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.value}
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={0.6} sx={{ minHeight: 44 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      lineHeight: 1.2,
                    }}
                  >
                    {row.label}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>{row.value}</Box>
                </Stack>
              )}
            </Card>
          </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

/* ── Status-based accent color for activity rows ────────── */
function activityAccentColor(status: string): string {
  const map: Record<string, string> = {
    draft: '#9e9e9e',
    submitted: '#3b8775',
    under_review: '#3b82f6',
    approved: '#4a7c59',
    rejected: '#d32f2f',
    needs_correction: '#e27429',
  };
  return map[status] || '#9e9e9e';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [reviewerStats, setReviewerStats] = useState<ReviewerDashboardStats | null>(null);
  const [userStats, setUserStats] = useState<UserDashboardStats | null>(null);

  const isAdmin = user?.roles.some((r) => r.name === 'Administrator');
  const isReviewerRole = user?.roles.some((r) => r.name === 'Reviewer');
  const isApproverRole = user?.roles.some((r) => r.name === 'Approver');
  const isReviewer = isReviewerRole || isApproverRole;
  const isResearchUser = user?.roles.some((r) => r.name === 'Research User');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<unknown>[] = [];

      if (isResearchUser) {
        promises.push(
          apiService
            .get<{ success: boolean; data: UserDashboardStats }>('/api/v1/reports/user/dashboard')
            .then((r) => setUserStats(r.data))
        );
      }

      if (isAdmin) {
        promises.push(
          apiService
            .get<{ success: boolean; data: AdminDashboardStats }>('/api/v1/reports/admin/dashboard')
            .then((r) => setAdminStats({
              ...r.data,
              role_distribution: r.data.role_distribution || [],
              approved_this_week: r.data.approved_this_week ?? 0,
              rejected_this_week: r.data.rejected_this_week ?? 0,
              pending_review_queue: r.data.pending_review_queue ?? 0,
              pending_approval_queue: r.data.pending_approval_queue ?? 0,
              needs_correction: r.data.needs_correction ?? 0,
              active_forms: r.data.active_forms ?? 0,
              avg_approval_time_hours: r.data.avg_approval_time_hours ?? 0,
              system_info: r.data.system_info || {
                app_version: '-',
                database_engine: '-',
                database_server_version: '-',
                debug_mode: false,
                workflow_mode: '-',
                generated_at: new Date().toISOString(),
              },
            }))
        );
      }

      if (isReviewer) {
        promises.push(
          apiService
            .get<{ success: boolean; data: ReviewerDashboardStats }>('/api/v1/reports/reviewer/dashboard')
            .then((r) => setReviewerStats(r.data))
        );
      }

      await Promise.all(promises);
    } catch {
      // Dashboard stats are non-blocking.
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isReviewer, isResearchUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const userCards: StatCard[] = isResearchUser
    ? [
        { title: 'Total Submissions', value: userStats?.my_submissions_total ?? '-', icon: <Description />, color: 'primary.main', bgcolor: 'primary.light' },
        { title: 'Drafts', value: userStats?.drafts ?? '-', icon: <Drafts />, color: '#9e9e9e', bgcolor: '#f5f5f5' },
        { title: 'Submitted', value: userStats?.submitted ?? '-', icon: <Send />, color: '#3b8775', bgcolor: '#e6f0ed' },
        { title: 'Approved', value: userStats?.approved ?? '-', icon: <CheckCircle />, color: '#4a7c59', bgcolor: '#e7f0e8' },
      ]
    : [];

  const reviewerCards: StatCard[] = [];
  if (isReviewerRole) {
    reviewerCards.push(
      { title: 'Pending Reviews', value: reviewerStats?.pending_reviews ?? '-', icon: <HourglassEmpty />, color: '#3b8775', bgcolor: '#e6f0ed' }
    );
  }
  if (isApproverRole) {
    reviewerCards.push(
      { title: 'Pending Approvals', value: reviewerStats?.pending_approvals ?? '-', icon: <Visibility />, color: '#3b82f6', bgcolor: '#e3f2fd' }
    );
  }
  if (isReviewerRole || isApproverRole) {
    reviewerCards.push(
      { title: isApproverRole && !isReviewerRole ? 'Approved Today' : 'Reviewed Today', value: reviewerStats?.reviewed_today ?? '-', icon: <Visibility />, color: '#3b82f6', bgcolor: '#e3f2fd' },
      { title: isApproverRole && !isReviewerRole ? 'Approved This Week' : 'Reviewed This Week', value: reviewerStats?.reviewed_this_week ?? '-', icon: <Visibility />, color: '#3b82f6', bgcolor: '#e3f2fd' },
      {
        title: 'Rejection Rate',
        value: reviewerStats?.rejection_rate_pct != null ? `${reviewerStats.rejection_rate_pct}%` : '-',
        icon: <Sync />,
        color: '#e27429',
        bgcolor: '#fcebe0',
      }
    );
  }

  const hasStats = isAdmin || isReviewer || isResearchUser;
  const nonAdminCards = isAdmin ? [] : [...userCards, ...reviewerCards];

  return (
    <Box>
      <PageHeader
        title={`Welcome back, ${user?.full_name || user?.username || 'User'}`}
        breadcrumbs={[{ label: 'Dashboard' }]}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {!hasStats && (
            <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="h6" color="text.secondary">
                No role assigned. Please contact an administrator.
              </Typography>
            </Card>
          )}

          {isAdmin && adminStats && (
            <Stack spacing={2.5} sx={{ mb: 4 }}>
              <Grid container spacing={2}>
                {[
                  { title: 'Total Requests', value: adminStats.total_submissions, icon: <Description />, color: '#3949ab', bgcolor: '#e8eaf6' },
                  { title: 'Active Users', value: adminStats.active_users, icon: <AdminPanelSettings />, color: '#2e7d32', bgcolor: '#e8f5e9' },
                  { title: 'Active Forms', value: adminStats.active_forms, icon: <Description />, color: '#5e35b1', bgcolor: '#ede7f6' },
                  { title: 'Pending Review', value: adminStats.pending_review_queue, icon: <HourglassEmpty />, color: '#3b8775', bgcolor: '#e6f0ed' },
                  { title: 'Pending Approval', value: adminStats.pending_approval_queue, icon: <Visibility />, color: '#3b82f6', bgcolor: '#e3f2fd' },
                  { title: 'Needs Correction', value: adminStats.needs_correction, icon: <Sync />, color: '#e27429', bgcolor: '#fcebe0' },
                  { title: 'Approval Rate', value: `${adminStats.approval_rate_pct}%`, icon: <CheckCircle />, color: '#4a7c59', bgcolor: '#e7f0e8' },
                  { title: 'Awaiting Action', value: adminStats.pending_review_queue + adminStats.pending_approval_queue, icon: <HourglassEmpty />, color: '#6d4c41', bgcolor: '#efebe9' },
                ].map((card, idx) => (
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={card.title}>
                    <CompactStatCard card={card} index={idx} />
                  </Grid>
                ))}
              </Grid>

              <Accordion
                defaultExpanded
                disableGutters
                square
                sx={(theme) => ({
                  border: '1px solid',
                  borderColor: theme.palette.divider,
                  borderRadius: '14px !important',
                  overflow: 'hidden',
                  boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.28 : 0.06)}`,
                  bgcolor: theme.palette.background.paper,
                  backgroundImage: 'none',
                  '&::before': { display: 'none' },
                })}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={(theme) => ({
                    px: 2,
                    pl: 2.5,
                    minHeight: 68,
                    position: 'relative',
                    bgcolor: theme.palette.background.paper,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 12,
                      bottom: 12,
                      width: 4,
                      borderRadius: '0 4px 4px 0',
                      backgroundColor: theme.palette.primary.main,
                    },
                    '& .MuiAccordionSummary-content': {
                      my: 1.25,
                    },
                  })}
                >
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', lg: 'center' }}
                    sx={{ width: '100%' }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Storage color="primary" />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Administration Insights
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Workflow summary, role coverage, and platform details
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={`Approved ${adminStats.approved_this_week}`} color="success" variant="outlined" />
                      <Chip size="small" label={`Review ${adminStats.pending_review_queue}`} color="warning" variant="outlined" />
                      <Chip size="small" label={`Approval ${adminStats.pending_approval_queue}`} color="info" variant="outlined" />
                    </Stack>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={(theme) => ({ p: 0, bgcolor: theme.palette.background.paper })}>
                  <Grid container>
                    <Grid size={{ xs: 12, lg: 4 }}>
                      <Box sx={{ p: 2.25 }}>
                        <InsightSection
                          title="Workflow Summary"
                          icon={<PendingActions color="primary" />}
                          rows={[
                            { label: 'Approved This Week', value: adminStats.approved_this_week },
                            { label: 'Rejected This Week', value: adminStats.rejected_this_week },
                            { label: 'Average Review Time', value: formatHours(adminStats.avg_review_time_hours) },
                            { label: 'Average Approval Time', value: formatHours(adminStats.avg_approval_time_hours) },
                            { label: 'Workflow Model', value: adminStats.system_info.workflow_mode },
                          ]}
                        />
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 4 }}>
                      <Box sx={{ p: 2.25 }}>
                        <InsightSection
                          title="Role Coverage"
                          icon={<AdminPanelSettings color="primary" />}
                          bordered
                          rows={[
                            ...adminStats.role_distribution.map((item) => ({
                              label: item.role_name,
                              value: item.count,
                            })),
                            { label: 'Configured Forms', value: adminStats.total_forms },
                            { label: 'Active Forms', value: adminStats.active_forms },
                          ]}
                        />
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 4 }}>
                      <Box sx={{ p: 2.25 }}>
                        <InsightSection
                          title="Information"
                          icon={<Storage color="primary" />}
                          bordered
                          rows={[
                            { label: 'Software Version', value: adminStats.system_info.app_version },
                            { label: 'Database Engine', value: adminStats.system_info.database_engine },
                            { label: 'Database Version', value: adminStats.system_info.database_server_version },
                            {
                              label: 'Debug Mode',
                              value: (
                                <Chip
                                  size="small"
                                  label={adminStats.system_info.debug_mode ? 'Enabled' : 'Disabled'}
                                  color={adminStats.system_info.debug_mode ? 'warning' : 'success'}
                                  variant="outlined"
                                />
                              ),
                            },
                            { label: 'Snapshot Generated', value: formatLocalDateTime(adminStats.system_info.generated_at) },
                          ]}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Stack>
          )}

          {nonAdminCards.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {nonAdminCards.map((card, idx) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
                  <CompactStatCard card={card} index={idx} />
                </Grid>
              ))}
            </Grid>
          )}

          {!isAdmin && (userStats?.recent_activity?.length || reviewerStats?.recent_activity?.length) > 0 && (
            <Card
              className="anim-fadeInUp"
              sx={{ p: 2, borderRadius: 3 }} // Reduced padding from 3 to 2
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Schedule color="primary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Recent Activity
                </Typography>
              </Stack>
              <Stack spacing={0.5}> {/* Tighter gap between rows */}
                {(userStats?.recent_activity || reviewerStats?.recent_activity || []).slice(0, 5).map((activity, index) => {
                  const status = (activity as unknown as { status?: string }).status || 'updated';
                  return (
                    <Box
                      key={`${activity.id}-${index}`}
                      sx={(theme) => ({
                        p: 1, // Reduced padding inside row
                        px: 1.5,
                        borderRadius: 1,
                        position: 'relative',
                        bgcolor: theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.02)'
                          : '#ffffff',
                        border: '1px solid',
                        borderColor: theme.palette.divider,
                        borderLeft: `3px solid ${activityAccentColor(status)}`,
                        animation: `fadeInUp 0.3s cubic-bezier(0.22,1,0.36,1) ${index * 0.05}s both`,
                        transition: 'transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                          transform: 'translateX(3px)',
                          bgcolor: theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.05)'
                            : 'grey.50',
                          boxShadow: theme.palette.mode === 'dark'
                            ? '0 2px 8px rgba(0,0,0,0.3)'
                            : '0 2px 8px rgba(0,0,0,0.04)',
                        },
                      })}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: 'primary.main',
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={() => navigate(`/submissions/${activity.id}`)}
                          >
                            {(activity as unknown as { request_number?: string }).request_number || 'Submission activity'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, textTransform: 'capitalize', display: 'block' }}>
                            {(status).replaceAll('_', ' ')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatLocalDateTime((activity as unknown as { updated_at?: string }).updated_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
