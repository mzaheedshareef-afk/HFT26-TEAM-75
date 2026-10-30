import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    const loginPath =
      allowedRole === 'company' ? '/company/login' : '/student/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (user.role !== allowedRole) {
    const correctDashboard =
      user.role === 'company' ? '/company/dashboard' : '/student/dashboard';
    return <Navigate to={correctDashboard} replace />;
  }

  return <>{children}</>;
}

