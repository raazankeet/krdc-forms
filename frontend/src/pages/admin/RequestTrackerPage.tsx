import { useState, useCallback } from 'react';
import {
  Box, TextField, Button, Typography, Card, CircularProgress,
  Alert, Stack, Chip, InputAdornment,
} from '@mui/material';
import { Search, Timeline, Person, CalendarToday } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import { formatLocalDateTimeWithRelative } from '../../utils/dateTime';
import type { ApiResponse } from '../../types';

interface TrailEntry {
  id: number;
  event_id: string;
  timestamp: string;
  action: string;
  action_label: string;
  user_name: string;
  user_role: string;
  comment: string | null;
  ip_address: string;
}

interface RequestTrail {
  request_number: string;
  form_name: string | null;
  form_code: string | null;
  submitter_name: string | null;
  current_status: string;
  submitted_at: string | null;
  created_at: string | null;
  trail: TrailEntry[];
}

function getDotColor(action: string): string {
  if (action.includes('submitted') || action.includes('resubmitted')) return 'primary.main';
  if (action.includes('approved') || action.includes('created')) return 'success.main';
  if (action.includes('rejected')) return 'error.main';
  if (action.includes('changes_requested') || action.includes('correction')) return 'warning.main';
  return 'grey.500';
}

function getBorderColor(action: string): string {
  if (action.includes('submitted') || action.includes('resubmitted')) return 'primary.main';
  if (action.includes('approved') || action.includes('created')) return 'success.main';
  if (action.includes('rejected')) return 'error.main';
  if (action.includes('changes_requested') || action.includes('correction')) return 'warning.main';
  return 'grey.400';
}

export default function RequestTrackerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [trail, setTrail] = useState<RequestTrail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setTrail(null);
    try {
      const res = await apiService.get<ApiResponse<RequestTrail>>(
        `/api/v1/audit/request-trail/${encodeURIComponent(query)}`,
      );
      setTrail(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Request not found or access denied.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  return (
    <Box>
      <PageHeader
        title="Request Tracker"
        subtitle="View the complete lifecycle journey of any request"
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Request Tracker' }]}
      />

      <Card sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Enter request number (e.g. REQ-MPAI-2026-000003)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            sx={{ minWidth: 110 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Track'}
          </Button>
        </Stack>
      </Card>

      {loading && <LoadingSkeleton variant="detail" />}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {trail && (
        <>
          {/* Header card */}
          <Card
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 3,
              borderLeft: 4,
              borderColor: 'primary.main',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                  {trail.request_number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {trail.form_name || trail.form_code} — submitted by {trail.submitter_name || 'Unknown'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <StatusChip status={trail.current_status as any} size="medium" />
                <Chip
                  icon={<Timeline />}
                  label={`${trail.trail.length} events`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Card>

          {/* Timeline */}
          <Box sx={{ position: 'relative', pl: 5 }}>
            {/* Vertical line */}
            <Box
              sx={{
                position: 'absolute',
                left: 13,
                top: 0,
                bottom: 0,
                width: 2,
                bgcolor: 'grey.300',
              }}
            />

            <Stack spacing={0}>
              {trail.trail.map((entry, index) => (
                <Box key={entry.id} sx={{ position: 'relative', mb: index < trail.trail.length - 1 ? 0 : 0 }}>
                  {/* Timeline dot */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -29,
                      top: 20,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: getDotColor(entry.action),
                      border: '2px solid',
                      borderColor: '#fff',
                      boxShadow: '0 0 0 2px #e0e0e0',
                      zIndex: 2,
                    }}
                  />

                  <Card
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: 2,
                      borderLeft: 3,
                      borderColor: getBorderColor(entry.action),
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {entry.action_label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatLocalDateTimeWithRelative(entry.timestamp)}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={2} sx={{ mt: 0.75 }} useFlexGap flexWrap="wrap">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {entry.user_name}
                        </Typography>
                      </Box>
                      <Chip label={entry.user_role} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Stack>

                    {entry.comment && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1.5,
                          bgcolor: 'grey.50',
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          "{entry.comment}"
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Box>
              ))}
            </Stack>
          </Box>
        </>
      )}

      {!loading && !error && !trail && (
        <EmptyState
          title="Track a Request"
          description="Enter a request number above to see its complete lifecycle journey."
        />
      )}
    </Box>
  );
}
