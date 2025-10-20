import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationContainer from './components/NotificationContainer';
import { useNotifications } from './contexts/NotificationContext';
import { useConfirmation } from './hooks/useConfirmation.tsx';
import { initializeCustomPopups } from './utils/customPopups';
import Welcome from './pages/Welcome';
import Profile from './pages/Profile';
import ProjectSelection from './pages/ProjectSelection';
import Dashboard from './pages/Dashboard';
import AkraPage from './pages/AkraPage';
import RingPage from './pages/RingPage';
import OpenPage from './pages/OpenPage';
import PacketPage from './pages/PacketPage';
import AdvancedFilter from './pages/AdvancedFilter';
import FilterCalculate from './pages/FilterCalculate';
import HistoryPage from './pages/HistoryPage';
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
      showSuccess,
      showError,
      showWarning,
      showInfo,
      confirm
    });
  }, [showSuccess, showError, showWarning, showInfo, confirm]);
  
  return (
    <>
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
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/akra"
                element={
                  <ProtectedRoute>
                    <AkraPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/ring"
                element={
                  <ProtectedRoute>
                    <RingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/open"
                element={
                  <ProtectedRoute>
                    <OpenPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/packet"
                element={
                  <ProtectedRoute>
                    <PacketPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/advanced-filter"
                element={
                  <ProtectedRoute>
                    <AdvancedFilter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/filter-calculate"
                element={
                  <ProtectedRoute>
                    <FilterCalculate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project/:id/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
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
        <AuthProvider>
          <NotificationProvider>
            <BrowserRouter>
              <AppWithNotifications />
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
