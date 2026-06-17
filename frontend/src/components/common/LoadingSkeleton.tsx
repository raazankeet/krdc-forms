import {
  Skeleton, Box, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Grid,
} from '@mui/material';

interface LoadingSkeletonProps {
  variant: 'table' | 'card' | 'detail' | 'dashboard';
  rows?: number;
}

export default function LoadingSkeleton({ variant, rows = 5 }: LoadingSkeletonProps) {
  if (variant === 'table') {
    return (
      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableCell key={i}>
                  <Skeleton variant="text" width="60%" height={20} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 5 }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton variant="text" width={colIdx === 0 ? '40%' : '70%'} height={20} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (variant === 'card') {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: rows }).map((_, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
            <Card sx={{ p: 2, borderRadius: 3 }}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2, mb: 2 }} />
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="80%" height={20} />
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'detail') {
    return (
      <Box>
        <Skeleton variant="text" width="40%" height={36} sx={{ mb: 2 }} />
        <Card sx={{ p: 3, borderRadius: 3 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Skeleton variant="text" width="20%" height={16} />
              <Skeleton variant="text" width="50%" height={24} />
            </Box>
          ))}
        </Card>
      </Box>
    );
  }

  // dashboard
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card sx={{ p: 2, borderRadius: 3 }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="50%" height={32} />
              <Skeleton variant="text" width="70%" height={20} />
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card sx={{ p: 3, borderRadius: 3 }}>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Card>
    </Box>
  );
}
