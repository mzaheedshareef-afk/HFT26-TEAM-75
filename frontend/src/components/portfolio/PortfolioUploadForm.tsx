import React, { useState } from 'react';
import {
  CheckCircle2,
  FileArchive,
  FileText,
  FolderGit2,
  Upload,
  X,
} from 'lucide-react';
import { FormInput } from '../ui/FormInput';
import { Button } from '../ui/Button';
import { AlertBanner } from '../ui/AlertBanner';
import type { PortfolioUploadInput } from '../../types/portfolio';

interface PortfolioUploadFormProps {
  initialGithubUrl?: string;
  initialLanguages?: string[];
  initialFrameworks?: string[];
  isSubmitting?: boolean;
  serverError?: string | null;
  successMessage?: string | null;
  onDismissError?: () => void;
  onSubmit: (payload: PortfolioUploadInput) => Promise<void> | void;
}

const LANGUAGE_OPTIONS = [
  'Python',
  'TypeScript',
  'JavaScript',
  'Java',
  'C++',
  'Go',
  'Rust',
  'SQL',
];

const FRAMEWORK_OPTIONS = [
  'React',
  'FastAPI',
  'Node.js',
  'Next.js',
  'Django',
  'Spring Boot',
  'Docker',
  'PostgreSQL',
];

const GITHUB_URL_REGEX =
  /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?\/?$/;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function validateGithubUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'GitHub profile or repository URL is required.';
  }
  if (!GITHUB_URL_REGEX.test(trimmed)) {
    return 'Please enter a valid GitHub URL (e.g., https://github.com/username or https://github.com/username/repo).';
  }
  return undefined;
}

export function PortfolioUploadForm({
  initialGithubUrl = '',
  initialLanguages = [],
  initialFrameworks = [],
  isSubmitting = false,
  serverError = null,
  successMessage = null,
  onDismissError,
  onSubmit,
}: PortfolioUploadFormProps) {
  const [githubUrl, setGithubUrl] = useState(initialGithubUrl);
  const [selectedLanguages, setSelectedLanguages] =
    useState<string[]>(initialLanguages);
  const [selectedFrameworks, setSelectedFrameworks] =
    useState<string[]>(initialFrameworks);
  const [portfolioNotes, setPortfolioNotes] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [projectArchiveFile, setProjectArchiveFile] = useState<File | null>(
    null
  );

  const [githubTouched, setGithubTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const githubError = validateGithubUrl(githubUrl);
  const languagesError =
    selectedLanguages.length === 0
      ? 'Select at least one primary programming language.'
      : undefined;

  const toggleItem = (
    item: string,
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
    );
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setResumeFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.json') && !lower.endsWith('.md')) {
      setFileError('Resume or summary must be a .pdf, .md, or .json file.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('Resume file size must be 15 MB or smaller.');
      e.target.value = '';
      return;
    }
    setResumeFile(file);
  };

  const handleArchiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setProjectArchiveFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.zip') && !lower.endsWith('.json')) {
      setFileError('Project artifact must be a .zip archive or .json manifest.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('Project archive size must be 15 MB or smaller.');
      e.target.value = '';
      return;
    }
    setProjectArchiveFile(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (githubError || languagesError || fileError) {
      return;
    }

    await onSubmit({
      githubUrl: githubUrl.trim(),
      primaryLanguages: selectedLanguages,
      frameworks: selectedFrameworks,
      portfolioNotes: portfolioNotes.trim() || undefined,
      resumeFile,
      projectArchiveFile,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <AlertBanner
          variant="error"
          message={serverError}
          onDismiss={onDismissError}
        />
      )}

      {fileError && (
        <AlertBanner
          variant="error"
          message={fileError}
          onDismiss={() => setFileError(null)}
        />
      )}

      {successMessage && !serverError && (
        <AlertBanner variant="success" message={successMessage} />
      )}

      {/* GitHub URL */}
      <FormInput
        id="portfolio-github-url"
        name="githubUrl"
        type="url"
        label="GitHub profile or repository URL"
        hint="Provide your primary GitHub profile or flagship project repository so GateCode can calibrate coding tasks to your stack."
        placeholder="https://github.com/your-username"
        spellCheck={false}
        required
        disabled={isSubmitting}
        value={githubUrl}
        onChange={(e) => {
          setGithubUrl(e.target.value);
          if (onDismissError) onDismissError();
        }}
        onBlur={() => {
          if (githubUrl.trim()) setGithubTouched(true);
        }}
        error={
          submitAttempted || githubTouched ? githubError : undefined
        }
        icon={<FolderGit2 className="h-4 w-4" />}
      />

      {/* Primary Programming Languages */}
      <fieldset className="space-y-2.5" disabled={isSubmitting}>
        <legend className="text-sm font-medium text-slate-800">
          Primary programming languages <span className="text-red-600">*</span>
        </legend>
        <p className="text-xs text-slate-500">
          Select the languages demonstrated across your repositories.
        </p>

        <div className="flex flex-wrap gap-2 pt-0.5">
          {LANGUAGE_OPTIONS.map((lang) => {
            const checked = selectedLanguages.includes(lang);
            return (
              <label
                key={lang}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800 ${
                  checked
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  name="primaryLanguages"
                  value={lang}
                  checked={checked}
                  onChange={() =>
                    toggleItem(lang, selectedLanguages, setSelectedLanguages)
                  }
                  className="h-3.5 w-3.5 rounded accent-blue-600"
                />
                <span>{lang}</span>
              </label>
            );
          })}
        </div>

        {submitAttempted && languagesError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {languagesError}
          </p>
        )}
      </fieldset>

      {/* Frameworks & Infrastructure */}
      <fieldset className="space-y-2.5" disabled={isSubmitting}>
        <legend className="text-sm font-medium text-slate-800">
          Frameworks &amp; infrastructure (optional)
        </legend>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORK_OPTIONS.map((fw) => {
            const checked = selectedFrameworks.includes(fw);
            return (
              <label
                key={fw}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white ${
                  checked
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  name="frameworks"
                  value={fw}
                  checked={checked}
                  onChange={() =>
                    toggleItem(fw, selectedFrameworks, setSelectedFrameworks)
                  }
                  className="sr-only"
                />
                {checked && (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{fw}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Native File Upload Controls styled with ::file-selector-button (modern-web-guidance: browser-ui-theming) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="portfolio-resume-file"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-800"
            >
              <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Technical Resume / Summary</span>
            </label>
            {resumeFile && (
              <button
                type="button"
                onClick={() => setResumeFile(null)}
                aria-label="Remove selected resume file"
                className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Optional `.pdf`, `.md`, or `.json` up to 15 MB.
          </p>
          <input
            id="portfolio-resume-file"
            name="resumeFile"
            type="file"
            accept=".pdf,.md,.json"
            disabled={isSubmitting}
            onChange={handleResumeChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer"
          />
          {resumeFile && (
            <p className="text-xs font-medium text-emerald-700 truncate">
              Selected: {resumeFile.name}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="portfolio-archive-file"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-800"
            >
              <FileArchive
                className="h-4 w-4 text-slate-500"
                aria-hidden="true"
              />
              <span>Project Artifact / Manifest</span>
            </label>
            {projectArchiveFile && (
              <button
                type="button"
                onClick={() => setProjectArchiveFile(null)}
                aria-label="Remove selected project archive"
                className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Optional `.zip` source archive or `.json` portfolio schema up to 15 MB.
          </p>
          <input
            id="portfolio-archive-file"
            name="projectArchiveFile"
            type="file"
            accept=".zip,.json"
            disabled={isSubmitting}
            onChange={handleArchiveChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer"
          />
          {projectArchiveFile && (
            <p className="text-xs font-medium text-emerald-700 truncate">
              Selected: {projectArchiveFile.name}
            </p>
          )}
        </div>
      </div>

      {/* Architectural Highlights / Notes */}
      <div className="space-y-1.5">
        <label
          htmlFor="portfolio-notes"
          className="block text-sm font-medium text-slate-800"
        >
          Key project architecture notes (optional)
        </label>
        <p className="text-xs text-slate-500">
          Briefly highlight core systems, algorithms, or APIs you built in your repositories.
        </p>
        <textarea
          id="portfolio-notes"
          name="portfolioNotes"
          rows={3}
          disabled={isSubmitting}
          value={portfolioNotes}
          onChange={(e) => setPortfolioNotes(e.target.value)}
          placeholder="e.g., Built an async job queue in Python/FastAPI with Redis caching and React dashboard..."
          className="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 disabled:bg-slate-50"
        />
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 pt-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          loadingText="Uploading portfolio..."
          leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
        >
          Save &amp; Analyze Portfolio
        </Button>
      </div>
    </form>
  );
}
