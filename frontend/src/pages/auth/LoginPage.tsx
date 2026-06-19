import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

/* ── Floating orb for the animated background ───────────── */
function Orb({
  size,
  top,
  left,
  color,
  delay,
}: {
  size: number;
  top: string;
  left: string;
  color: string;
  delay: string;
}) {
  return (
    <Box
      sx={{
        position: 'absolute',
        width: size,
        height: size,
        top,
        left,
        borderRadius: '50%',
        background: color,
        filter: 'blur(80px)',
        animation: `float 6s ease-in-out ${delay} infinite`,
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  );
}

/* ── Styles for the custom HTML inputs ──────────────────── */
const fieldWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 18px',
  borderRadius: 14,
  backgroundColor: 'rgba(30, 30, 60, 0.55)',
  border: '1px solid rgba(255,255,255,0.12)',
  transition: 'border-color 0.25s ease, background-color 0.25s ease',
  cursor: 'text',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'none',
  color: '#fff',
  fontSize: '0.95rem',
  fontFamily: '"Inter", system-ui, sans-serif',
  letterSpacing: '0.01em',
  lineHeight: 1.5,
  padding: 0,
  width: '100%',
};

const iconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  color: 'rgba(255,255,255,0.4)',
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  position: 'absolute',
  top: -9,
  left: 14,
  fontSize: '0.72rem',
  color: 'rgba(255,255,255,0.5)',
  backgroundColor: 'rgba(30, 30, 60, 0.9)',
  padding: '0 6px',
  borderRadius: 4,
  letterSpacing: '0.03em',
  fontFamily: '"Inter", system-ui, sans-serif',
  pointerEvents: 'none',
};

/* ── SVG Icons (no MUI icon dependency on the login page) ── */
function UserIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (axiosErr?.response?.status === 401) {
        setError('Invalid username or password. Please try again.');
      } else if (axiosErr?.response?.data?.error?.message) {
        setError(axiosErr.response.data.error.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getWrapperStyle = (field: string): React.CSSProperties => ({
    ...fieldWrapperStyle,
    borderColor: focusedField === field
      ? 'rgba(255,255,255,0.4)'
      : 'rgba(255,255,255,0.12)',
    backgroundColor: focusedField === field
      ? 'rgba(30, 30, 60, 0.7)'
      : 'rgba(30, 30, 60, 0.55)',
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 100%)',
        p: 2,
      }}
    >
      {/* Animated gradient orbs */}
      <Orb size={400} top="-10%" left="-5%" color="rgba(99, 102, 241, 0.5)" delay="0s" />
      <Orb size={350} top="60%" left="70%" color="rgba(139, 92, 246, 0.4)" delay="2s" />
      <Orb size={250} top="30%" left="55%" color="rgba(59, 130, 246, 0.35)" delay="4s" />
      <Orb size={200} top="75%" left="10%" color="rgba(168, 85, 247, 0.3)" delay="1s" />
      <Orb size={180} top="5%" left="80%" color="rgba(79, 70, 229, 0.35)" delay="3s" />

      {/* Glassmorphic card */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          width: '100%',
          animation: 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <Box
          sx={{
            p: { xs: 3.5, sm: 4.5 },
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.07)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Logo + Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              component="img"
              src="/crystal-logo_big.png"
              alt="Crystal Logo"
              sx={{
                height: 72,
                width: 'auto',
                mb: 2.5,
                filter: 'drop-shadow(0 4px 20px rgba(99, 102, 241, 0.35))',
              }}
            />
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', mb: 0.5 }}
            >
              Sign in to GLP Forms
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}
            >
              Research Laboratory Form Management
            </Typography>
          </Box>

          {/* Error */}
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: '12px',
                bgcolor: 'rgba(239, 83, 80, 0.12)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 83, 80, 0.25)',
                '& .MuiAlert-icon': { color: '#fca5a5' },
              }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          {/* Form with plain HTML inputs */}
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 20 }}>
              <div style={getWrapperStyle('username')}>
                <span style={labelStyle}>Username</span>
                <UserIcon />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  style={inputStyle}
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <div style={getWrapperStyle('password')}>
                <span style={labelStyle}>Password</span>
                <LockIcon />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  style={inputStyle}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 24px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.9) 100%)',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: '"Inter", system-ui, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading && <CircularProgress size={20} sx={{ color: '#fff' }} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </Box>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.04em',
          }}
        >
          Crystal Crop Protect Limited · GLP Compliance Platform
        </Typography>
      </Box>
    </Box>
  );
}
