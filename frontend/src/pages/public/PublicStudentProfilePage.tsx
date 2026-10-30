import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { PublicProfileCard } from '../../components/profile/PublicProfileCard';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { ProfilePageSkeleton } from '../../components/ui/LoadingSkeleton';
import {
  ProfileAccessRestrictedError,
  profileService,
} from '../../services/profileService';
import { extractApiErrorMessage } from '../../services/api';
import type { PublicStudentProfile } from '../../types/profile';

type PublicProfileLoadState =
  | 'loading'
  | 'ready'
  | 'private'
  | 'not_found'
  | 'error';

export function PublicStudentProfilePage() {
  const { shareId } = useParams<{ shareId?: string }>();

  const [profile, setProfile] = useState<PublicStudentProfile | null>(null);
  const [loadState, setLoadState] = useState<PublicProfileLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPublicProfile = useCallback(
    async (isCancelled?: () => boolean) => {
      if (!shareId || !shareId.trim()) {
        setLoadState('not_found');
        return;
      }

      setLoadState('loading');
      setErrorMessage(null);

      try {
        const fetched = await profileService.getPublicProfile(shareId);
        if (isCancelled?.()) return;
        setProfile(fetched);
        setLoadState('ready');
      } catch (error) {
        if (isCancelled?.()) return;

        if (error instanceof ProfileAccessRestrictedError) {
          setProfile(null);
          setLoadState('private');
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setProfile(null);
          setLoadState('not_found');
          return;
        }

        setProfile(null);
        setLoadState('error');
        setErrorMessage(
          extractApiErrorMessage(
            error,
            'Unable to retrieve this public profile right now.'
          )
        );
      }
    },
    [shareId]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchPublicProfile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchPublicProfile]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLogo size="sm" />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>GateCode Platform</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loadState === 'loading' && <ProfilePageSkeleton />}

        {loadState === 'private' && (
          <section
            role="alert"
            className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-2xs space-y-4"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900">
                This Student Profile is Private
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                The candidate has disabled public sharing or set their profile visibility to Private. No candidate details or assessment records are publicly accessible.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Return to GateCode
            </Link>
          </section>
        )}

        {loadState === 'not_found' && (
          <section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-2xs space-y-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900">
                Public Profile Not Found
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                This shareable profile link does not exist or has been revoked by the candidate.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Return to GateCode
            </Link>
          </section>
        )}

        {loadState === 'error' && (
          <section className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-2xs space-y-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-base font-bold text-slate-900">
              Profile Service Unavailable
            </h1>
            <p className="text-xs text-slate-600">{errorMessage}</p>
          </section>
        )}

        {loadState === 'ready' && profile && (
          <PublicProfileCard profile={profile} />
        )}
      </main>
    </div>
  );
}

