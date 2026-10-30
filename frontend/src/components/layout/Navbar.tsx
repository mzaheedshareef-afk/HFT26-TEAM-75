import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const dashboardPath =
    user?.role === 'company' ? '/company/dashboard' : '/student/dashboard';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <BrandLogo />
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
              Methodology
            </a>
            <a href="#for-candidates" className="hover:text-slate-900 transition-colors">
              For Candidates
            </a>
            <a href="#for-companies" className="hover:text-slate-900 transition-colors">
              For Companies
            </a>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                to="/student/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Candidate Login
              </Link>
              <Link
                to="/company/login"
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                Company Login
              </Link>
              <Link
                to="/student/signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                <span>Get Started</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-menu"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-4"
        >
          <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-2.5 py-2 hover:bg-slate-50"
            >
              Methodology
            </a>
            <a
              href="#for-candidates"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-2.5 py-2 hover:bg-slate-50"
            >
              For Candidates
            </a>
            <a
              href="#for-companies"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-2.5 py-2 hover:bg-slate-50"
            >
              For Companies
            </a>
          </nav>

          <div className="border-t border-slate-200 pt-3 flex flex-col gap-2.5">
            {isAuthenticated && user ? (
              <Link
                to={dashboardPath}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to="/student/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Candidate Login
                </Link>
                <Link
                  to="/company/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Company Login
                </Link>
                <Link
                  to="/student/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <span>Candidate Sign Up</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
