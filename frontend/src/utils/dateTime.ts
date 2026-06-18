import { formatDistanceToNow } from 'date-fns';

const HAS_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/i;

export function parseApiDateTime(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes('T') && !HAS_TIMEZONE_SUFFIX.test(value)
    ? `${value}Z`
    : value;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateTime(value?: string | null): string {
  const parsed = parseApiDateTime(value);
  return parsed ? parsed.toLocaleString() : '—';
}

export function formatRelativeDateTime(value?: string | null): string {
  const parsed = parseApiDateTime(value);
  return parsed ? formatDistanceToNow(parsed, { addSuffix: true }) : '—';
}

export function formatLocalDateTimeWithRelative(value?: string | null): string {
  const parsed = parseApiDateTime(value);
  return parsed ? `${parsed.toLocaleString()} (${formatDistanceToNow(parsed, { addSuffix: true })})` : '—';
}
