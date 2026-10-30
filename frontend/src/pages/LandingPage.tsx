import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Code2,
  GitBranch,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../context/AuthContext';

const pillars = [
  {
    icon: GitBranch,
    step: '01',
    title: 'Portfolio Signal Analysis',
    description:
      'Extracts real technology stacks, architectural patterns, and domain depth directly from a candidate’s engineering projects.',
  },
  {
    icon: Code2,
    step: '02',
    title: 'Adaptive Task Calibration',
    description:
      'Generates practical, domain-relevant coding challenges aligned with demonstrated skills rather than generic puzzle trivia.',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Deterministic Evaluation',
    description:
      'Executes submissions in isolated sandboxes to measure correctness, efficiency, and engineering consistency.',
  },
];

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const dashboardPath =
    user?.role === 'company' ? '/company/dashboard' : '/student/dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50/70 to-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>Portfolio-Driven Adaptive Technical Assessments</span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12]">
                  Evaluate engineering talent by what they actually build.
                </h1>

                <p className="max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed">
                  GateCode bridges real project portfolios with adaptive coding
                  assessments—helping candidates demonstrate authentic technical
                  depth and enabling hiring teams to evaluate verified
                  engineering capability.
                </p>

                {isAuthenticated && user ? (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to={dashboardPath}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      <span>Continue to {user.role === 'company' ? 'Company' : 'Candidate'} Dashboard</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                    <Link
                      to="/student/signup"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      <GraduationCap className="h-4 w-4" aria-hidden="true" />
                      <span>Start as Candidate</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>

                    <Link
                      to="/company/signup"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <Building2 className="h-4 w-4 text-slate-600" aria-hidden="true" />
                      <span>Hire with GateCode</span>
                    </Link>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-slate-500">
                  <span>Role-isolated workspaces</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>Stack-calibrated challenges</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>Sandboxed verification</span>
                </div>
              </div>

              {/* Architectural Summary Card */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Assessment Workflow
                      </p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        Adaptive Verification Pipeline
                      </p>
                    </div>
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200/60">
                      GateCode Engine
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Stage 1 &middot; Portfolio Context</span>
                        <span className="text-slate-700 font-mono">Python &middot; FastAPI &middot; React</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        Repository structure and complexity signals inform assessment scope.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Stage 2 &middot; Adaptive Challenge</span>
                        <span className="text-blue-700 font-medium">Calibrated</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        Targeted implementation &amp; debugging tasks matched to verified stack depth.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Stage 3 &middot; Competency Signal</span>
                        <span className="text-emerald-700 font-medium">Verified</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        Structured evaluation across correctness, code efficiency, and consistency.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology Section */}
        <section id="how-it-works" className="py-16 sm:py-20 border-b border-slate-200/80">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Methodology
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Designed for high-signal technical evaluation
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Every assessment adapts to real engineering artifacts rather than one-size-fits-all question banks.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.step}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-xs font-medium text-slate-400">
                        {pillar.step}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-slate-900">
                        {pillar.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dual Portals Section */}
        <section className="py-16 sm:py-20 bg-slate-50/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Choose your workspace
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Dedicated portals for engineering candidates and technical hiring teams.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Candidate Portal Card */}
              <div
                id="for-candidates"
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7 sm:p-8 shadow-2xs"
              >
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/60">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>For Students &amp; Candidates</span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      Showcase verified engineering skills
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Create your candidate profile, link your project portfolio,
                      and complete adaptive assessments tailored to your actual
                      development experience.
                    </p>
                  </div>

                  <ul className="space-y-2.5 text-sm text-slate-700 pt-1">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                      <span>Assessments calibrated to your stack and projects</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                      <span>Transparent technical competency benchmarks</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
                  <Link
                    to="/student/signup"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    <span>Candidate Sign Up</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/student/login"
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Candidate Login
                  </Link>
                </div>
              </div>

              {/* Company Portal Card */}
              <div
                id="for-companies"
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7 sm:p-8 shadow-2xs"
              >
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-200">
                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>For Companies &amp; Recruiters</span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      Hire with portfolio-backed confidence
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Register your organization to evaluate engineering
                      candidates with adaptive coding tasks and structured
                      technical performance insights.
                    </p>
                  </div>

                  <ul className="space-y-2.5 text-sm text-slate-700 pt-1">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-slate-800 shrink-0" aria-hidden="true" />
                      <span>Eliminate resume keyword noise and generic quizzes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-slate-800 shrink-0" aria-hidden="true" />
                      <span>Consistent, role-relevant technical evaluation metrics</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
                  <Link
                    to="/company/signup"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <span>Company Sign Up</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/company/login"
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Company Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

