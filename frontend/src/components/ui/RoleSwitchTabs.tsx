import { Link } from 'react-router-dom';
import { Building2, GraduationCap } from 'lucide-react';
import type { UserRole } from '../../types/auth';

interface RoleSwitchTabsProps {
  activeRole: UserRole;
  mode: 'login' | 'signup';
}

export function RoleSwitchTabs({ activeRole, mode }: RoleSwitchTabsProps) {
  const studentPath = mode === 'login' ? '/student/login' : '/student/signup';
  const companyPath = mode === 'login' ? '/company/login' : '/company/signup';

  return (
    <div
      role="navigation"
      aria-label="Account portal selector"
      className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200/80"
    >
      <Link
        to={studentPath}
        aria-current={activeRole === 'student' ? 'page' : undefined}
        className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-medium transition-colors ${
          activeRole === 'student'
            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Candidate</span>
      </Link>

      <Link
        to={companyPath}
        aria-current={activeRole === 'company' ? 'page' : undefined}
        className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-medium transition-colors ${
          activeRole === 'company'
            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Company</span>
      </Link>
    </div>
  );
}

