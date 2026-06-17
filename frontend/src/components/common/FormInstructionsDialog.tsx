import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { FormMetadata } from '../../types/form';

interface FormInstructionsDialogProps {
  open: boolean;
  metadata: FormMetadata;
  onClose: () => void;
}

export default function FormInstructionsDialog({ open, metadata, onClose }: FormInstructionsDialogProps) {
  const instructions = metadata.instructions;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{metadata.name} Instructions</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
              Purpose
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {instructions?.summary || metadata.description}
            </Typography>
          </Box>

          {(instructions?.sections || []).map((section) => (
            <Box key={section.title}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                {section.title}
              </Typography>
              <Stack spacing={0.75}>
                {section.items.map((item) => (
                  <Typography key={item} variant="body2" color="text.secondary">
                    - {item}
                  </Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
