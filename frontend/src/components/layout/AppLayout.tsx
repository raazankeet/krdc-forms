import { useState } from 'react';
import { Outlet, useMatches, useNavigate } from 'react-router-dom';
import {
  Box, AppBar as MuiAppBar, Toolbar, Typography, IconButton,
  Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Badge, Tooltip,
  Fade,
} from '@mui/material';
import {
  NotificationsOutlined, DarkMode, LightMode, Logout,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const matches = useMatches();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  // Generate breadcrumbs from route matches
  const breadcrumbs = matches
    .filter((m) => (m.handle as { breadcrumb?: string } | undefined)?.breadcrumb)
    .map((m) => ({
      label: ((m.handle as { breadcrumb?: string }).breadcrumb)!,
      href: m.pathname,
    }));

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || '?';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <MuiAppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Box
              component="img"
              src="/crystal_logo.png"
              alt="Crystal Logo"
              sx={{ height: 44, width: 'auto' }}
            />
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              GLP Forms
            </Typography>
          </Box>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5, ml: 2 }}>
              {breadcrumbs.map((crumb, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {idx > 0 && (
                    <Typography variant="body2" color="text.disabled" sx={{ mx: 0.5 }}>
                      /
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color={idx === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                    sx={{ cursor: idx < breadcrumbs.length - 1 ? 'pointer' : 'default', fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400 }}
                    onClick={() => idx < breadcrumbs.length - 1 && navigate(crumb.href)}
                  >
                    {crumb.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* Notification bell */}
          <Tooltip title="Notifications">
            <IconButton>
              <Badge badgeContent={0} color="error">
                <NotificationsOutlined />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton onClick={toggleTheme}>
              {mode === 'light' ? <DarkMode /> : <LightMode />}
            </IconButton>
          </Tooltip>

          {/* User menu */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: 'primary.main',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {userInitials}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 200 } } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {user?.full_name || user?.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.roles.map((r) => r.name).join(', ') || 'No role'}
              </Typography>
            </Box>
            <MenuItem onClick={() => { setAnchorEl(null); toggleTheme(); }}>
              <ListItemIcon>{mode === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}</ListItemIcon>
              <ListItemText>{mode === 'light' ? 'Dark mode' : 'Light mode'}</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              <ListItemText>Sign out</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </MuiAppBar>

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: 8,
          p: 3,
          minHeight: 'calc(100vh - 64px)',
          overflow: 'auto',
          bgcolor: 'background.default',
          transition: 'margin 0.2s ease-in-out',
        }}
      >
        <Fade in timeout={300}>
          <Box>
            <Outlet />
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}
