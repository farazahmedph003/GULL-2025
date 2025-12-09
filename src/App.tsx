import React, { Suspense, lazy, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import { ScalingProvider } from './contexts/ScalingContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PushNotificationProvider } from './contexts/PushNotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationContainer from './components/NotificationContainer';
import NotificationBanner from './components/NotificationBanner';
import { useNotifications } from './contexts/NotificationContext';
import { useConfirmation } from './hooks/useConfirmation.tsx';
import { initializeCustomPopups } from './utils/customPopups';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import { startSyncLoop } from './services/syncManager';

// Create and export Confirmation Context for global access
interface ConfirmationOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmationContext = createContext<((message: string, options?: ConfirmationOptions) => Promise<boolean>) | null>(null);

// Lazy load pages for better performance
const Welcome = lazy(() => import('./pages/Welcome'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AdminOpenPage = lazy(() => import('./pages/admin/AdminOpenPage'));
const AdminAkraPage = lazy(() => import('./pages/admin/AdminAkraPage'));
const AdminRingPage = lazy(() => import('./pages/admin/AdminRingPage'));
const AdminPacketPage = lazy(() => import('./pages/admin/AdminPacketPage'));
const AdminFilterPage = lazy(() => import('./pages/admin/AdminFilterPage'));
const AdminAdvancedFilterPage = lazy(() => import('./pages/admin/AdminAdvancedFilterPage'));
const AdminAmountLimitsPage = lazy(() => import('./pages/admin/AdminAmountLimitsPage'));
const TestAdminFeatures = lazy(() => import('./pages/admin/TestAdminFeatures'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Component that renders notifications and initializes custom popups
const AppWithNotifications: React.FC = () => {
  const { notifications, removeNotification, showSuccess, showError, showWarning, showInfo } = useNotifications();
  const { confirm, ConfirmationComponent } = useConfirmation();
  
  // Initialize custom popup system
  React.useEffect(() => {
    initializeCustomPopups({
      showSuccess: (title, message, options) => {
        // Handle async properly but return immediately for backward compatibility
        showSuccess(title, message, options).catch(console.error);
        return 'temp-id';
      },
      showError: (title, message, options) => {
        showError(title, message, options).catch(console.error);
        return 'temp-id';
      },
      showWarning: (title, message, options) => {
        showWarning(title, message, options).catch(console.error);
        return 'temp-id';
      },
      showInfo: (title, message, options) => {
        showInfo(title, message, options).catch(console.error);
        return 'temp-id';
      },
      confirm
    });
  }, [showSuccess, showError, showWarning, showInfo, confirm]);
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
      <ConfirmationContext.Provider value={confirm}>
        <NotificationBanner />
        <Suspense fallback={<div></div>}>
        <Routes>
              {/* Public routes */}
              <Route path="/welcome" element={<Welcome />} />
              
              {/* Protected routes - Root route (role-based) */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    {isAdmin ? (
                      <Navigate to="/admin" replace />
                    ) : (
                      <UserDashboard />
                    )}
                  </ProtectedRoute>
                }
              />
              
          {/* Profile route */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Settings route (Admin only) */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="open" element={<AdminOpenPage />} />
            <Route path="akra" element={<AdminAkraPage />} />
            <Route path="ring" element={<AdminRingPage />} />
            <Route path="packet" element={<AdminPacketPage />} />
            <Route path="filter" element={<AdminFilterPage />} />
            <Route path="advanced-filter" element={<AdminAdvancedFilterPage />} />
            <Route path="amount-limits" element={<AdminAmountLimitsPage />} />
            <Route path="test-features" element={<TestAdminFeatures />} />
          </Route>
              
              {/* 404 route */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
        </Suspense>
      <NotificationContainer 
        notifications={notifications} 
        onClose={removeNotification} 
      />
      <ConfirmationComponent />
    </ConfirmationContext.Provider>
  );
};

const App: React.FC = () => {
  // Start offline->online sync loop once app mounts (every 2 seconds)
  React.useEffect(() => {
    startSyncLoop(2000);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppearanceProvider>
          <ScalingProvider>
            <AuthProvider>
              <NotificationProvider>
                <PushNotificationProvider>
                  <BrowserRouter>
                    <AppWithNotifications />
                  </BrowserRouter>
                </PushNotificationProvider>
              </NotificationProvider>
            </AuthProvider>
          </ScalingProvider>
        </AppearanceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
