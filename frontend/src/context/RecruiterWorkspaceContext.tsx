import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { recruiterService } from '../services/recruiterService';
import { MAX_COMPARISON_CANDIDATES } from '../types/recruiter';

export interface ComparisonTrayCandidate {
  candidate_id: string;
  display_name: string;
  headline?: string;
}

interface ToggleComparisonResult {
  added: boolean;
  removed: boolean;
  limitReached: boolean;
}

interface RecruiterWorkspaceContextValue {
  comparisonTray: ComparisonTrayCandidate[];
  isInComparison: (candidateId: string) => boolean;
  toggleComparisonCandidate: (
    candidate: ComparisonTrayCandidate
  ) => ToggleComparisonResult;
  addComparisonCandidatesByIds: (
    candidates: ComparisonTrayCandidate[]
  ) => void;
  removeComparisonCandidate: (candidateId: string) => void;
  clearComparison: () => void;
  shortlistedIds: Set<string>;
  syncShortlistedIds: (ids: string[]) => void;
  setShortlistedStatus: (candidateId: string, isShortlisted: boolean) => void;
}

const RecruiterWorkspaceContext = createContext<
  RecruiterWorkspaceContextValue | undefined
>(undefined);

function getComparisonStorageKey(companyUserId: string): string {
  return `gatecode_recruiter_compare_${companyUserId}`;
}

function readStoredComparisonTray(
  companyUserId: string | null
): ComparisonTrayCandidate[] {
  if (!companyUserId) return [];
  try {
    const raw = sessionStorage.getItem(getComparisonStorageKey(companyUserId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ComparisonTrayCandidate =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.candidate_id === 'string' &&
          item.candidate_id.trim().length > 0
      )
      .slice(0, MAX_COMPARISON_CANDIDATES);
  } catch {
    return [];
  }
}

export function RecruiterWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const activeCompanyId =
    isAuthenticated && user?.role === 'company' ? user.id : null;

  const [comparisonTray, setComparisonTray] = useState<
    ComparisonTrayCandidate[]
  >(() => readStoredComparisonTray(activeCompanyId));

  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(
    () => new Set()
  );

  // Sync or purge state whenever authenticated company user changes or logs out
  useEffect(() => {
    if (!activeCompanyId) {
      setComparisonTray([]);
      setShortlistedIds(new Set());
      recruiterService.resetClientGuards();
      return;
    }
    setComparisonTray(readStoredComparisonTray(activeCompanyId));
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    try {
      sessionStorage.setItem(
        getComparisonStorageKey(activeCompanyId),
        JSON.stringify(comparisonTray)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [activeCompanyId, comparisonTray]);

  const isInComparison = useCallback(
    (candidateId: string) =>
      comparisonTray.some((item) => item.candidate_id === candidateId),
    [comparisonTray]
  );

  const toggleComparisonCandidate = useCallback(
    (candidate: ComparisonTrayCandidate): ToggleComparisonResult => {
      const exists = comparisonTray.some(
        (item) => item.candidate_id === candidate.candidate_id
      );

      if (exists) {
        setComparisonTray((prev) =>
          prev.filter((item) => item.candidate_id !== candidate.candidate_id)
        );
        return { added: false, removed: true, limitReached: false };
      }

      if (comparisonTray.length >= MAX_COMPARISON_CANDIDATES) {
        return { added: false, removed: false, limitReached: true };
      }

      setComparisonTray((prev) => {
        if (prev.some((item) => item.candidate_id === candidate.candidate_id)) {
          return prev;
        }
        if (prev.length >= MAX_COMPARISON_CANDIDATES) {
          return prev;
        }
        return [...prev, candidate];
      });
      return { added: true, removed: false, limitReached: false };
    },
    [comparisonTray]
  );

  const addComparisonCandidatesByIds = useCallback(
    (candidates: ComparisonTrayCandidate[]) => {
      setComparisonTray((prev) => {
        const merged = [...prev];
        for (const cand of candidates) {
          if (merged.length >= MAX_COMPARISON_CANDIDATES) break;
          if (!merged.some((m) => m.candidate_id === cand.candidate_id)) {
            merged.push(cand);
          }
        }
        return merged;
      });
    },
    []
  );

  const removeComparisonCandidate = useCallback((candidateId: string) => {
    setComparisonTray((prev) =>
      prev.filter((item) => item.candidate_id !== candidateId)
    );
  }, []);

  const clearComparison = useCallback(() => {
    setComparisonTray([]);
  }, []);

  const syncShortlistedIds = useCallback((ids: string[]) => {
    setShortlistedIds(new Set(ids));
  }, []);

  const setShortlistedStatus = useCallback(
    (candidateId: string, isShortlisted: boolean) => {
      setShortlistedIds((prev) => {
        const next = new Set(prev);
        if (isShortlisted) {
          next.add(candidateId);
        } else {
          next.delete(candidateId);
        }
        return next;
      });
    },
    []
  );

  const contextValue = useMemo<RecruiterWorkspaceContextValue>(
    () => ({
      comparisonTray,
      isInComparison,
      toggleComparisonCandidate,
      addComparisonCandidatesByIds,
      removeComparisonCandidate,
      clearComparison,
      shortlistedIds,
      syncShortlistedIds,
      setShortlistedStatus,
    }),
    [
      addComparisonCandidatesByIds,
      clearComparison,
      comparisonTray,
      isInComparison,
      removeComparisonCandidate,
      setShortlistedStatus,
      shortlistedIds,
      syncShortlistedIds,
      toggleComparisonCandidate,
    ]
  );

  return (
    <RecruiterWorkspaceContext.Provider value={contextValue}>
      {children}
    </RecruiterWorkspaceContext.Provider>
  );
}

export function useRecruiterWorkspace(): RecruiterWorkspaceContextValue {
  const context = useContext(RecruiterWorkspaceContext);
  if (!context) {
    throw new Error(
      'useRecruiterWorkspace must be used within a RecruiterWorkspaceProvider'
    );
  }
  return context;
}

