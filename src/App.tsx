import React from 'react';
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
import Welcome from './pages/Welcome';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import UserDashboard from './pages/UserDashboard';
import LoadingSpinner from './components/LoadingSpinner';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AdminOpenPage from './pages/admin/AdminOpenPage';
import AdminAkraPage from './pages/admin/AdminAkraPage';
import AdminRingPage from './pages/admin/AdminRingPage';
import AdminPacketPage from './pages/admin/AdminPacketPage';
import AdminFilterPage from './pages/admin/AdminFilterPage';
import AdminAdvancedFilterPage from './pages/admin/AdminAdvancedFilterPage';
import TestAdminFeatures from './pages/admin/TestAdminFeatures';
import NotFound from './pages/NotFound';

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
  
  const { user, loading } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
      <>
        <NotificationBanner />
        <Routes>
              {/* Public routes */}
              <Route path="/welcome" element={<Welcome />} />
              
              {/* Protected routes - Root route (role-based) */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    {loading ? (
                      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                        <LoadingSpinner size="lg" text="Loading..." />
                      </div>
                    ) : isAdmin ? (
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
            <Route path="test-features" element={<TestAdminFeatures />} />
          </Route>
              
              {/* 404 route */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
      <NotificationContainer 
        notifications={notifications} 
        onClose={removeNotification} 
      />
      <ConfirmationComponent />
    </>
  );
};

const App: React.FC = () => {
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
