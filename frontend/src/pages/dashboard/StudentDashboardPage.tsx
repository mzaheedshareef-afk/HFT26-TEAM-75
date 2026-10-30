import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Code2,
  FolderGit2,
  GraduationCap,
  LineChart,
  LogOut,
} from 'lucide-react';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

const upcomingSlots = [
  {
    icon: FolderGit2,
    title: 'Portfolio Ingestion Module',
    description:
      'Reserved workspace slot for connecting GitHub repositories and technical project artifacts.',
  },
  {
    icon: Code2,
    title: 'Adaptive Coding Assessment',
    description:
      'Reserved workspace slot for taking stack-calibrated coding challenges in an isolated execution environment.',
  },
  {
    icon: LineChart,
    title: 'Competency & Growth Signals',
    description:
      'Reserved workspace slot for viewing submission performance and technical consistency reports.',
  },
];

export function StudentDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Candidate Workspace</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
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
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>Authenticated Candidate Session</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {user?.name || 'Candidate'}
              </h1>
              <p className="text-sm text-slate-600">
                Student Dashboard Placeholder &mdash; your candidate account is authenticated and ready for workspace module integration.
              </p>
            </div>

            {user && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1 shrink-0">
                <p>
                  <span className="font-medium text-slate-800">Account ID:</span>{' '}
                  <span className="font-mono">{user.id}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-800">Role:</span>{' '}
                  <span className="uppercase font-mono">{user.role}</span>
                </p>
                <p className="sm:hidden">
                  <span className="font-medium text-slate-800">Email:</span>{' '}
                  {user.email}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Upcoming Candidate Modules (Placeholder)
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {upcomingSlots.map((slot) => {
              const Icon = slot.icon;
              return (
                <div
                  key={slot.title}
                  className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-6 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Pending Module
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {slot.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {slot.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

