import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { RoleSwitchTabs } from '../ui/RoleSwitchTabs';
import type { UserRole } from '../../types/auth';

interface AuthLayoutProps {
  role: UserRole;
  mode: 'login' | 'signup';
  title: string;
  subtitle: string;
  footerPrompt: string;
  footerLinkText: string;
  footerLinkTo: string;
  children: React.ReactNode;
}

const roleContext = {
  student: {
    badge: 'Candidate Portal',
    headline: 'Prove real engineering capability beyond static resumes.',
    description:
      'GateCode calibrates technical challenges directly to the languages, architectures, and projects demonstrated in your portfolio.',
    highlights: [
      'Adaptive coding assessments tailored to your demonstrated tech stack',
      'Isolated, deterministic evaluation on practical engineering tasks',
      'Verified technical competency profile for hiring teams',
    ],
  },
  company: {
    badge: 'Hiring & Assessment Portal',
    headline: 'Evaluate candidates on the engineering work they actually build.',
    description:
      'Replace generic puzzle screening with portfolio-calibrated technical evaluations and structured competency signals.',
    highlights: [
      'Automated portfolio-driven challenge calibration per candidate',
      'Objective code quality, efficiency, and consistency signals',
      'Streamlined technical shortlisting for engineering teams',
    ],
  },
};

export function AuthLayout({
  role,
  mode,
  title,
  subtitle,
  footerPrompt,
  footerLinkText,
  footerLinkTo,
  children,
}: AuthLayoutProps) {
  const info = roleContext[role];

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-12">
      {/* Desktop Context Sidebar — hidden on mobile so form fields & submit button stay above the mobile keyboard */}
      <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between border-r border-slate-200 bg-slate-50 p-10 xl:p-12">
        <div className="space-y-10">
          <div className="flex items-center justify-between">
            <BrandLogo />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="space-y-4 pt-4">
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs">
              {info.badge}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 leading-snug">
              {info.headline}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {info.description}
            </p>
          </div>

          <ul className="space-y-3.5 border-t border-slate-200/80 pt-6">
            {info.highlights.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-slate-700"
              >
                <CheckCircle2
                  className="h-4 w-4 text-blue-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          GateCode Platform &middot; Secure Role-Based Authentication
        </p>
      </aside>

      {/* Main Form Column */}
      <main className="lg:col-span-7 flex flex-col min-h-screen lg:min-h-0">
        {/* Compact Mobile Top Bar */}
        <div className="flex lg:hidden items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-6">
          <BrandLogo size="sm" />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </div>

        <div className="flex flex-1 items-start lg:items-center justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-12">
          <div className="w-full max-w-md space-y-6">
            <RoleSwitchTabs activeRole={role} mode={mode} />

            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              <p className="text-sm text-slate-600">{subtitle}</p>
            </div>

            {children}

            <p className="border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
              {footerPrompt}{' '}
              <Link
                to={footerLinkTo}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {footerLinkText}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

