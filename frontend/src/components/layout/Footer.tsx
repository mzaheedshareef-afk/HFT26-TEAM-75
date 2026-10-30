import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <BrandLogo size="sm" />
            <p className="text-xs text-slate-500 max-w-sm">
              Portfolio-Driven Adaptive Coding &amp; Technical Assessment Platform.
              Built by Team Gate Code (HFT26-TEAM-75).
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
            <Link to="/student/login" className="hover:text-slate-900">
              Candidate Sign In
            </Link>
            <Link to="/student/signup" className="hover:text-slate-900">
              Candidate Sign Up
            </Link>
            <Link to="/company/login" className="hover:text-slate-900">
              Company Sign In
            </Link>
            <Link to="/company/signup" className="hover:text-slate-900">
              Company Sign Up
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200/80 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} GateCode. All rights reserved.</p>
          <p>CBIT Hacktoberfest &apos;26 &middot; Team 75</p>
        </div>
      </div>
    </footer>
  );
}

