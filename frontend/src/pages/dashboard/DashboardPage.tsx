import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Grid, CircularProgress,
} from '@mui/material';
import {
  Description, RateReview, CheckCircle, HourglassEmpty,
  Drafts, Send, Cancel,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import type { AdminDashboardStats, ReviewerDashboardStats, UserDashboardStats } from '../../types';

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  bgcolor: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [reviewerStats, setReviewerStats] = useState<ReviewerDashboardStats | null>(null);
  const [userStats, setUserStats] = useState<UserDashboardStats | null>(null);

  const isAdmin = user?.roles.some((r) => r.name === 'Administrator');
  const isReviewer = user?.roles.some((r) => r.name === 'Reviewer' || r.name === 'Approver');
  const isResearchUser = user?.roles.some((r) => r.name === 'Research User');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<unknown>[] = [];
      if (isAdmin || isResearchUser) {
        promises.push(
          apiService.get<{ success: boolean; data: UserDashboardStats }>('/api/v1/reports/user/dashboard')
            .then((r) => setUserStats(r.data))
        );
      }
      if (isAdmin) {
        promises.push(
          apiService.get<{ success: boolean; data: AdminDashboardStats }>('/api/v1/reports/admin/dashboard')
            .then((r) => setAdminStats(r.data))
        );
      }
      if (isReviewer || isAdmin) {
        promises.push(
          apiService.get<{ success: boolean; data: ReviewerDashboardStats }>('/api/v1/reports/reviewer/dashboard')
            .then((r) => setReviewerStats(r.data))
        );
      }
      await Promise.all(promises);
    } catch {
      // Stats are non-critical, silently fail
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isReviewer, isResearchUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards: StatCard[] = [];

  if (isResearchUser || isAdmin) {
    statCards.push(
      { title: 'Total Submissions', value: userStats?.my_submissions_total ?? '—', icon: <Description />, color: 'primary.main', bgcolor: 'primary.light' },
      { title: 'Drafts', value: userStats?.drafts ?? '—', icon: <Drafts />, color: 'text.secondary', bgcolor: 'grey.200' },
      { title: 'Submitted', value: userStats?.submitted ?? '—', icon: <Send />, color: '#7b1fa2', bgcolor: '#e1bee7' },
      { title: 'Approved', value: userStats?.approved ?? '—', icon: <CheckCircle />, color: 'success.main', bgcolor: 'success.light' },
    );
  }

  if (isReviewer || isAdmin) {
    statCards.push(
      { title: 'Pending Reviews', value: reviewerStats?.pending_reviews ?? '—', icon: <HourglassEmpty />, color: 'warning.main', bgcolor: 'warning.light' },
      { title: 'Reviewed Today', value: reviewerStats?.reviewed_today ?? '—', icon: <RateReview />, color: 'info.main', bgcolor: 'info.light' },
      { title: 'Rejection Rate', value: reviewerStats?.rejection_rate_pct != null ? `${reviewerStats.rejection_rate_pct}%` : '—', icon: <Cancel />, color: 'error.main', bgcolor: 'error.light' },
    );
  }

  const hasStats = isAdmin || isReviewer || isResearchUser;

  return (
    <Box>
      <PageHeader
        title={`Welcome back, ${user?.full_name || user?.username || 'User'}`}
        subtitle={user?.roles.map((r) => r.name).join(', ') || 'No role'}
        breadcrumbs={[{ label: 'Dashboard' }]}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {hasStats && statCards.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {statCards.map((card, idx) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                  <Card sx={{ p: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                      width: 48, height: 48, borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: card.bgcolor, color: card.color,
                    }}>
                      {card.icon}
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{card.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{card.title}</Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {!hasStats && (
            <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="h6" color="text.secondary">
                No role assigned. Please contact an administrator.
              </Typography>
            </Card>
          )}

          {isAdmin && adminStats && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>System Overview</Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{adminStats.active_users}</Typography>
                      <Typography variant="body2" color="text.secondary">Active Users</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{adminStats.total_forms}</Typography>
                      <Typography variant="body2" color="text.secondary">Forms</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{adminStats.total_submissions}</Typography>
                      <Typography variant="body2" color="text.secondary">Total Submissions</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{adminStats.approval_rate_pct}%</Typography>
                      <Typography variant="body2" color="text.secondary">Approval Rate</Typography>
                    </Grid>
                  </Grid>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}
