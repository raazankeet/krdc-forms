import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Box, Divider, IconButton,
} from '@mui/material';
import {
  Dashboard, Description, RateReview, Assignment,
  People, DynamicForm, History, ChevronLeft, ChevronRight,
  ManageSearch,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 240;
const MINI_DRAWER_WIDTH = 56;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactElement;
  roles?: string[];
  permissions?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Dashboard /> },
  { label: 'My Forms', path: '/my-forms', icon: <Description /> },
  { label: 'My Submissions', path: '/submissions', icon: <Assignment /> },
  { label: 'Review Queue', path: '/reviews', icon: <RateReview />, roles: ['Reviewer', 'Approver'] },
  { label: 'My Reviews', path: '/reviews/my', icon: <ManageSearch />, roles: ['Reviewer', 'Approver'] },
  { label: 'Requests', path: '/requests', icon: <ManageSearch />, roles: ['Administrator'] },
  { label: 'User Management', path: '/admin/users', icon: <People />, roles: ['Administrator'] },
  { label: 'Form Management', path: '/admin/forms', icon: <DynamicForm />, roles: ['Administrator'] },
  { label: 'Audit Log', path: '/admin/audit', icon: <History />, roles: ['Administrator'] },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRoleNames = user?.roles.map((r) => r.name) || [];
  const userPermissions = user?.roles.flatMap((r) => r.permissions.map((p) => p.code)) || [];

  const canView = (item: NavItem) => {
    if (!item.roles && !item.permissions) return true;
    if (item.roles && item.roles.some((r) => userRoleNames.includes(r))) return true;
    if (item.permissions && item.permissions.some((p) => userPermissions.includes(p))) return true;
    return false;
  };

  const filteredItems = navItems.filter(canView);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
          overflowX: 'hidden',
          transition: 'width 0.2s ease-in-out',
          borderRight: '1px solid',
          borderColor: 'divider',
          mt: 8,
        },
      }}
      slotProps={{ paper: { elevation: 0 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
        <IconButton onClick={onToggle} size="small">
          {open ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>

      <Divider />

      <List sx={{ px: 1 }}>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const button = (
            <ListItemButton
              key={item.path}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                minHeight: 44,
                justifyContent: open ? 'initial' : 'center',
                px: open ? 1.5 : 1,
                bgcolor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? 'primary.contrastText' : 'text.secondary',
                '&:hover': {
                  bgcolor: isActive ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 1.5 : 0,
                  justifyContent: 'center',
                  color: isActive ? 'primary.contrastText' : 'action.active',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {open && <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: isActive ? 600 : 400 } } }} />}
            </ListItemButton>
          );

          if (!open) {
            return (
              <Tooltip key={item.path} title={item.label} placement="right">
                {button}
              </Tooltip>
            );
          }

          return button;
        })}
      </List>
    </Drawer>
  );
}
