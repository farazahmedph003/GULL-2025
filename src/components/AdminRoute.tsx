import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminByEmail } from '../utils/roleHelpers';

interface AdminRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ 
  children, 
  fallbackPath = '/project-selection' 
}) => {
  const { user } = useAuth();

  // If user is not logged in, redirect to welcome
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // If user is not an admin, redirect to fallback path
  if (!isAdminByEmail(user.email)) {
    return <Navigate to={fallbackPath} replace />;
  }

  // User is admin, render the protected content
  return <>{children}</>;
};

export default AdminRoute;
