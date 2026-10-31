import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RecruiterWorkspaceProvider } from './context/RecruiterWorkspaceContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { StudentSignupPage } from './pages/auth/StudentSignupPage';
import { StudentLoginPage } from './pages/auth/StudentLoginPage';
import { CompanySignupPage } from './pages/auth/CompanySignupPage';
import { CompanyLoginPage } from './pages/auth/CompanyLoginPage';
import { StudentDashboardPage } from './pages/dashboard/StudentDashboardPage';
import { CompanyDashboardPage } from './pages/dashboard/CompanyDashboardPage';
import { CandidateDiscoveryPage } from './pages/company/CandidateDiscoveryPage';
import { CandidateProfileDetailPage } from './pages/company/CandidateProfileDetailPage';
import { ShortlistedCandidatesPage } from './pages/company/ShortlistedCandidatesPage';
import { CandidateComparisonPage } from './pages/company/CandidateComparisonPage';
import { CompanyProfilePage } from './pages/company/CompanyProfilePage';
import { CompanyAccountSettingsPage } from './pages/company/CompanyAccountSettingsPage';
import { PortfolioPage } from './pages/student/PortfolioPage';
import { AssessmentInstructionsPage } from './pages/student/AssessmentInstructionsPage';
import { AssessmentWorkspacePage } from './pages/student/AssessmentWorkspacePage';
import { AssessmentResultsPage } from './pages/student/AssessmentResultsPage';
import { StudentAnalyticsPage } from './pages/student/StudentAnalyticsPage';
import { AssessmentHistoryPage } from './pages/student/AssessmentHistoryPage';
import { StudentProfileSettingsPage } from './pages/student/StudentProfileSettingsPage';
import { PublicStudentProfilePage } from './pages/public/PublicStudentProfilePage';
import { BrandLogo } from './components/ui/BrandLogo';
import { BackendOfflineBanner } from './components/common/BackendOfflineBanner';

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="max-w-md space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-2xs">
        <div className="flex justify-center">
          <BrandLogo size="sm" />
        </div>
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">
            404 &middot; Page Not Found
          </p>
          <h1 className="text-xl font-bold text-slate-900">
            We couldn&apos;t find that page
          </h1>
          <p className="text-sm text-slate-600">
            The route you requested does not exist or may have moved.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          Return to Landing Page
        </Link>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <RecruiterWorkspaceProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/student/signup" element={<StudentSignupPage />} />
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route path="/company/signup" element={<CompanySignupPage />} />
        <Route path="/company/login" element={<CompanyLoginPage />} />
        <Route path="/profile/:shareId" element={<PublicStudentProfilePage />} />
        <Route path="/p/:shareId" element={<PublicStudentProfilePage />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/portfolio"
          element={
            <ProtectedRoute allowedRole="student">
              <PortfolioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/analytics"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/history"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/profile"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentProfileSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/instructions"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentInstructionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/:assessmentId/instructions"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentInstructionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/workspace"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/:assessmentId/workspace"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/results"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/assessment/:assessmentId/results"
          element={
            <ProtectedRoute allowedRole="student">
              <AssessmentResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/dashboard"
          element={
            <ProtectedRoute allowedRole="company">
              <CompanyDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/candidates"
          element={
            <ProtectedRoute allowedRole="company">
              <CandidateDiscoveryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/candidates/:candidateId"
          element={
            <ProtectedRoute allowedRole="company">
              <CandidateProfileDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/shortlist"
          element={
            <ProtectedRoute allowedRole="company">
              <ShortlistedCandidatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/compare"
          element={
            <ProtectedRoute allowedRole="company">
              <CandidateComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/profile"
          element={
            <ProtectedRoute allowedRole="company">
              <CompanyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company/settings"
          element={
            <ProtectedRoute allowedRole="company">
              <CompanyAccountSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RecruiterWorkspaceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <BackendOfflineBanner />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
