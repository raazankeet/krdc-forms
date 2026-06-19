import { Box, Typography, Button } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import { InboxOutlined } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';

interface EmptyStateProps {
  icon?: React.ReactElement<SvgIconProps>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  sx?: SxProps<Theme>;
}

export default function EmptyState({
  icon = <InboxOutlined sx={{ fontSize: 72 }} />,
  title,
  description,
  actionLabel,
  onAction,
  sx,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 2,
        textAlign: 'center',
        ...sx,
      }}
    >
      <Box
        className="anim-float"
        sx={{ color: 'text.disabled', mb: 2 }}
      >
        {icon}
      </Box>
      <Typography
        variant="h6"
        color="text.secondary"
        gutterBottom
        className="anim-fadeInUp"
      >
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.disabled"
          className="anim-fadeInUp-d1"
          sx={{ maxWidth: 400, mb: 3 }}
        >
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Box className="anim-fadeInUp-d2">
          <Button variant="contained" onClick={onAction}>
            {actionLabel}
          </Button>
        </Box>
      )}
    </Box>
  );
}
