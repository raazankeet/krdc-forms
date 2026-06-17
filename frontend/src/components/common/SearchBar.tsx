import { TextField, InputAdornment } from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
  fullWidth?: boolean;
}

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  fullWidth = false,
}: SearchBarProps) {
  const [value, setValue] = useState('');

  const debouncedSearch = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (val: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => onSearch(val), debounceMs);
      };
    })(),
    [onSearch, debounceMs]
  );

  useEffect(() => {
    debouncedSearch(value);
    return () => {};
  }, [value, debouncedSearch]);

  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      fullWidth={fullWidth}
      sx={{ minWidth: fullWidth ? undefined : 280 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <Clear
                fontSize="small"
                sx={{ cursor: 'pointer' }}
                onClick={() => { setValue(''); onSearch(''); }}
              />
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}
