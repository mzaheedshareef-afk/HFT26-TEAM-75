import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookmarkCheck,
  Building2,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useRecruiterWorkspace } from '../../context/RecruiterWorkspaceContext';
import { MAX_COMPARISON_CANDIDATES } from '../../types/recruiter';

interface RecruiterShellProps {
  children: React.ReactNode;
}

interface SidebarNavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
}

export const RECRUITER_NAV_ITEMS: SidebarNavItem[] = [
  {
    label: 'Dashboard',
    to: '/company/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Find Candidates',
    to: '/company/candidates',
    icon: Search,
    matchPrefix: '/company/candidates',
  },
  {
    label: 'Shortlisted Candidates',
    to: '/company/shortlist',
    icon: BookmarkCheck,
  },
  {
    label: 'Candidate Comparison',
    to: '/company/compare',
    icon: GitCompareArrows,
  },
  {
    label: 'Company Profile',
    to: '/company/profile',
    icon: Building2,
  },
  {
    label: 'Account Settings',
    to: '/company/settings',
    icon: Settings,
  },
];

export function RecruiterShell({ children }: RecruiterShellProps) {
  const { user, logout } = useAuth();
  const { comparisonTray, shortlistedIds } = useRecruiterWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const isItemActive = (item: SidebarNavItem): boolean => {
    if (item.matchPrefix) {
      return location.pathname.startsWith(item.matchPrefix);
    }
    return location.pathname === item.to;
  };

  const getItemBadge = (to: string): string | null => {
    if (to === '/company/shortlist' && shortlistedIds.size > 0) {
      return String(shortlistedIds.size);
    }
    if (to === '/company/compare' && comparisonTray.length > 0) {
      return `${comparisonTray.length}/${MAX_COMPARISON_CANDIDATES}`;
    }
    return null;
  };

  const compareLinkTarget =
    comparisonTray.length > 0
      ? `/company/compare?ids=${encodeURIComponent(
          comparisonTray.map((c) => c.candidate_id).join(',')
        )}`
      : '/company/compare';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900">
      {/* Top Recruiter Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={
                mobileMenuOpen
                  ? 'Close recruiter sidebar'
                  : 'Open recruiter sidebar'
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="recruiter-mobile-sidebar"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <BrandLogo size="sm" />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Company Portal</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            {comparisonTray.length > 0 && (
              <Link
                to={compareLinkTarget}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Compare ({comparisonTray.length}/{MAX_COMPARISON_CANDIDATES})
                </span>
              </Link>
            )}

            {user && (
              <div className="hidden md:block text-right">
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

        {/* Mobile Quick Navigation Strip */}
        <nav
          aria-label="Mobile recruiter navigation"
          className="flex lg:hidden items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 bg-white"
        >
          {RECRUITER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            const badge = getItemBadge(item.to);
            const target =
              item.to === '/company/compare' ? compareLinkTarget : item.to;

            return (
              <Link
                key={item.to}
                to={target}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{item.label}</span>
                {badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expandable Mobile Sidebar Menu */}
        {mobileMenuOpen && (
          <div
            id="recruiter-mobile-sidebar"
            className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 shadow-md space-y-3"
          >
            {user && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <p className="text-xs font-semibold text-slate-900">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            )}
            <nav
              aria-label="Mobile recruiter drawer navigation"
              className="grid gap-1"
            >
              {RECRUITER_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                const badge = getItemBadge(item.to);
                const target =
                  item.to === '/company/compare' ? compareLinkTarget : item.to;

                return (
                  <Link
                    key={item.to}
                    to={target}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Body with Desktop Persistent Sidebar */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <aside
          aria-label="Recruiter sidebar navigation"
          className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-5"
        >
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Recruiter Workspace</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || 'Company Team'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                Verified Talent Discovery
              </p>
            </div>

            <nav aria-label="Primary recruiter navigation" className="space-y-1">
              {RECRUITER_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                const badge = getItemBadge(item.to);
                const target =
                  item.to === '/company/compare' ? compareLinkTarget : item.to;

                return (
                  <Link
                    key={item.to}
                    to={target}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-800">
              Evidence-Based Hiring
            </p>
            <p className="leading-relaxed">
              Verified sandbox scores and AI efficiency metrics are strictly separated from self-reported portfolio items.
            </p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 py-7 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

