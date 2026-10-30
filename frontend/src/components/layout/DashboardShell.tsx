import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Code2,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface DashboardShellProps {
  role: UserRole;
  children: React.ReactNode;
  fullBleed?: boolean;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const studentNavItems: NavItem[] = [
  { label: 'Overview', to: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Portfolio', to: '/student/portfolio', icon: FolderGit2 },
  {
    label: 'Assessment',
    to: '/student/assessment/instructions',
    icon: Code2,
  },
];

const companyNavItems: NavItem[] = [
  { label: 'Hiring Overview', to: '/company/dashboard', icon: LayoutDashboard },
];

export function DashboardShell({
  role,
  children,
  fullBleed = false,
}: DashboardShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = role === 'company' ? companyNavItems : studentNavItems;

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const isNavItemActive = (to: string) => {
    if (to === '/student/assessment/instructions') {
      return location.pathname.startsWith('/student/assessment');
    }
    return location.pathname === to;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" />
              {role === 'student' ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Candidate Workspace</span>
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Company Portal</span>
                </span>
              )}
            </div>

            <nav
              aria-label="Workspace navigation"
              className="hidden md:flex items-center gap-1"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {user && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900 leading-tight">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 leading-tight">
                  {user.email}
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Mobile Secondary Workspace Nav */}
        {navItems.length > 1 && (
          <nav
            aria-label="Mobile workspace navigation"
            className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 bg-white"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main
        className={
          fullBleed
            ? 'flex-1 flex flex-col'
            : 'flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8'
        }
      >
        {children}
      </main>
    </div>
  );
}

