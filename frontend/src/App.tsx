import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { ThemeContextProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { SnackbarProvider } from 'notistack';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import SubmissionListPage from './pages/submissions/SubmissionListPage';
import SubmissionEditPage from './pages/submissions/SubmissionEditPage';
import SubmissionDetailPage from './pages/submissions/SubmissionDetailPage';
import MyFormsPage from './pages/forms/MyFormsPage';
import ReviewQueuePage from './pages/reviews/ReviewQueuePage';
import ReviewDetailPage from './pages/reviews/ReviewDetailPage';
import MyReviewsPage from './pages/reviews/MyReviewsPage';
import RequestManagementPage from './pages/requests/RequestManagementPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import FormManagementPage from './pages/admin/FormManagementPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import RequestTrackerPage from './pages/admin/RequestTrackerPage';
import PrintPreviewPage from './pages/print/PrintPreviewPage';

/** Root layout — wraps all providers so the data router can use context-dependent hooks */
function RootLayout() {
  return (
    <ThemeContextProvider>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        autoHideDuration={4000}
      >
        <AuthProvider>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeContextProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      /* Public routes */
      { path: '/login', element: <LoginPage /> },
      { path: '/unauthorized', element: <UnauthorizedPage /> },

      /* Protected routes with AppLayout */
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              /* Dashboard — all authenticated users */
              {
                index: true,
                element: <DashboardPage />,
                handle: { breadcrumb: 'Dashboard' },
              },

              /* Request Management — authenticated users, role-filtered within page */
              {
                path: 'requests',
                element: <ProtectedRoute requiredPermission="review.view" />,
                children: [
                  {
                    index: true,
                    element: <RequestManagementPage />,
                    handle: { breadcrumb: 'Request Management' },
                  },
                ],
              },

              /* My Forms — form catalog for all authenticated users */
              {
                path: 'my-forms',
                element: <MyFormsPage />,
                handle: { breadcrumb: 'My Forms' },
              },

              /* Submissions — all authenticated users (backend filters by role) */
              {
                path: 'submissions',
                children: [
                  {
                    index: true,
                    element: <SubmissionListPage />,
                    handle: { breadcrumb: 'Submissions' },
                  },
                  {
                    path: 'new',
                    element: <SubmissionEditPage />,
                    handle: { breadcrumb: 'New Submission' },
                  },
                  {
                    path: ':id/edit',
                    element: <SubmissionEditPage />,
                    handle: { breadcrumb: 'Edit' },
                  },
                  {
                    path: ':id',
                    element: <SubmissionDetailPage />,
                    handle: { breadcrumb: 'Detail' },
                  },
                ],
              },

              /* Reviews — Reviewer / Approver */
              {
                path: 'reviews',
                children: [
                  {
                    index: true,
                    element: (
                      <ProtectedRoute requiredPermission="review.view">
                        <ReviewQueuePage />
                      </ProtectedRoute>
                    ),
                    handle: { breadcrumb: 'Review Queue' },
                  },
                  {
                    path: 'my',
                    element: (
                      <ProtectedRoute requiredPermission="review.view">
                        <MyReviewsPage />
                      </ProtectedRoute>
                    ),
                    handle: { breadcrumb: 'My Reviews' },
                  },
                  {
                    path: ':id',
                    element: (
                      <ProtectedRoute requiredPermission="review.view">
                        <ReviewDetailPage />
                      </ProtectedRoute>
                    ),
                    handle: { breadcrumb: 'Review' },
                  },
                ],
              },

              /* Admin — Administrator only */
              {
                path: 'admin',
                element: <ProtectedRoute requiredRole="Administrator" />,
                children: [
                  {
                    path: 'users',
                    element: <UserManagementPage />,
                    handle: { breadcrumb: 'Users' },
                  },
                  {
                    path: 'forms',
                    element: <FormManagementPage />,
                    handle: { breadcrumb: 'Forms' },
                  },
                  {
                    path: 'audit',
                    element: <AuditLogPage />,
                    handle: { breadcrumb: 'Audit Log' },
                  },
                  {
                    path: 'request-tracker',
                    element: <RequestTrackerPage />,
                    handle: { breadcrumb: 'Request Tracker' },
                  },
                ],
              },

              /* Print — approved submissions */
              {
                path: 'print/:id',
                element: <PrintPreviewPage />,
                handle: { breadcrumb: 'Print' },
              },
            ],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
