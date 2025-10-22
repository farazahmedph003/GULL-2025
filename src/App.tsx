import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import { ScalingProvider } from './contexts/ScalingContext';
import { AuthProvider } from './contexts/AuthContext';
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
import ProjectSelection from './pages/ProjectSelection';
// import Dashboard from './pages/Dashboard';
import AkraPage from './pages/AkraPage';
import RingPage from './pages/RingPage';
import OpenPage from './pages/OpenPage';
import PacketPage from './pages/PacketPage';
import AdvancedFilter from './pages/AdvancedFilter';
import FilterCalculate from './pages/FilterCalculate';
import HistoryPage from './pages/HistoryPage';
import UserDashboard from './pages/UserDashboard';
import AdminRoute from './components/AdminRoute';
import AdminPanel from './pages/AdminPanel';
import UserProjects from './pages/UserProjects';
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
  
  return (
      <>
        <NotificationBanner />
        <Routes>
              {/* Public routes */}
              <Route path="/welcome" element={<Welcome />} />
              
              {/* Protected routes - Root route */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ProjectSelection />
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

          {/* Settings route */}
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

          {/* Admin Panel route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          {/* Admin -> User projects */}
          <Route
            path="/admin/user/:uid"
            element={
              <ProtectedRoute>
                <UserProjects />
              </ProtectedRoute>
            }
          />
              
              {/* Project routes */}
              <Route
                path="/project/:id"
                element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/akra"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AkraPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/ring"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <RingPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/open"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <OpenPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/packet"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <PacketPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/advanced-filter"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AdvancedFilter />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/filter-calculate"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <FilterCalculate />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/history"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <HistoryPage />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              
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
