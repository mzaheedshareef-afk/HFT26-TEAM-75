import { useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import {
  Check,
  Code2,
  Moon,
  RotateCcw,
  Sun,
  Wand2,
} from 'lucide-react';
import { CORE_CODING_LANGUAGES } from '../../services/assessmentService';
import type { SupportedLanguage } from '../../types/assessment';

export const DEFAULT_STARTER_CODE: Record<SupportedLanguage, string> = {
  python: `import sys\n\ndef solve() -> None:\n    data = sys.stdin.read().strip().splitlines()\n    # Write your solution here\n\nif __name__ == "__main__":\n    solve()\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Write your solution here\n    return 0;\n}\n`,
  typescript: `import * as fs from 'fs';\n\nfunction solve(): void {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nsolve();\n`,
  javascript: `const fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nsolve();\n`,
};

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python 3.12',
  java: 'Java 21',
  cpp: 'C++ 20',
  typescript: 'TypeScript',
  javascript: 'JavaScript (Node)',
};

export const MONACO_LANGUAGE_IDS: Record<SupportedLanguage, string> = {
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  typescript: 'typescript',
  javascript: 'javascript',
};

function countNetBracesOutsideStrings(line: string): {
  leadingClose: number;
  netDelta: number;
} {
  let leadingClose = 0;
  let seenNonClose = false;
  let netDelta = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (!inSingle && !inDouble && ch === '/' && next === '/') {
      break;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      seenNonClose = true;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      seenNonClose = true;
      continue;
    }
    if (inSingle || inDouble) {
      continue;
    }

    if (ch === '}') {
      if (!seenNonClose) {
        leadingClose += 1;
      }
      netDelta -= 1;
    } else if (ch === '{') {
      seenNonClose = true;
      netDelta += 1;
    } else if (!/\s/.test(ch)) {
      seenNonClose = true;
    }
  }

  return { leadingClose, netDelta };
}

/**
 * Formats source code consistently across Python, Java, C++, TypeScript, and JavaScript.
 * - Preserves Python significant indentation while normalizing tabs, line endings, and trailing spaces.
 * - Normalizes brace-block indentation for Java, C++, TypeScript, and JavaScript.
 */
export function formatSourceCode(
  rawCode: string,
  language: SupportedLanguage
): string {
  const normalizedNewlines = rawCode.replace(/\r\n?/g, '\n');
  const tabSpaces =
    language === 'typescript' || language === 'javascript' ? '  ' : '    ';
  const rawLines = normalizedNewlines.split('\n');

  let formattedLines: string[];

  if (language === 'python') {
    formattedLines = rawLines.map((line) =>
      line.replace(/\t/g, tabSpaces).replace(/[ \t]+$/g, '')
    );
  } else {
    let indentLevel = 0;
    formattedLines = rawLines.map((rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return '';

      // Keep C/C++ preprocessor directives flush-left
      if (language === 'cpp' && trimmed.startsWith('#')) {
        return trimmed;
      }

      const { leadingClose, netDelta } = countNetBracesOutsideStrings(trimmed);
      const effectiveIndent = Math.max(0, indentLevel - leadingClose);
      const indented = `${tabSpaces.repeat(effectiveIndent)}${trimmed}`;
      indentLevel = Math.max(0, indentLevel + netDelta);
      return indented;
    });
  }

  // Collapse 3+ consecutive blank lines into at most 1 blank line
  const compacted: string[] = [];
  let blankStreak = 0;
  for (const line of formattedLines) {
    if (line === '') {
      blankStreak += 1;
      if (blankStreak <= 1) {
        compacted.push('');
      }
    } else {
      blankStreak = 0;
      compacted.push(line);
    }
  }

  const joined = compacted.join('\n').trim();
  return joined ? `${joined}\n` : '';
}

interface CodeEditorPanelProps {
  language: SupportedLanguage;
  allowedLanguages?: SupportedLanguage[];
  code: string;
  hasBackendStarter?: boolean;
  isModifiedFromStarter?: boolean;
  readOnly?: boolean;
  onLanguageChange: (language: SupportedLanguage) => void;
  onCodeChange: (code: string) => void;
  onResetStarterCode?: () => void;
}

export function CodeEditorPanel({
  language,
  allowedLanguages,
  code,
  hasBackendStarter = false,
  isModifiedFromStarter = false,
  readOnly = false,
  onLanguageChange,
  onCodeChange,
  onResetStarterCode,
}: CodeEditorPanelProps) {
  const [fontSize, setFontSize] = useState(14);
  const [editorTheme, setEditorTheme] = useState<'light' | 'vs-dark'>('light');
  const [justFormatted, setJustFormatted] = useState(false);

  const monacoEditorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const isTestEnv = import.meta.env.MODE === 'test';

  // Ensure Python, Java, and C++ are always available alongside any backend-supplied languages
  const selectableLanguages = useMemo(() => {
    const base =
      allowedLanguages && allowedLanguages.length > 0
        ? [...allowedLanguages]
        : ['python', 'java', 'cpp', 'typescript', 'javascript'];
    for (const core of CORE_CODING_LANGUAGES) {
      if (!base.includes(core)) {
        base.push(core);
      }
    }
    return base as SupportedLanguage[];
  }, [allowedLanguages]);

  const lineCount = useMemo(
    () => (code ? code.split('\n').length : 1),
    [code]
  );

  const handleEditorMount: OnMount = (editorInstance) => {
    monacoEditorRef.current = editorInstance;
  };

  const handleFormatCode = () => {
    if (readOnly || !code.trim()) return;

    const formatted = formatSourceCode(code, language);
    if (formatted !== code) {
      onCodeChange(formatted);
    }

    // Trigger Monaco native language formatter action when available (e.g. TS/JS worker)
    const formatAction = monacoEditorRef.current?.getAction(
      'editor.action.formatDocument'
    );
    if (formatAction) {
      void formatAction.run();
    }

    setJustFormatted(true);
    window.setTimeout(() => {
      setJustFormatted(false);
    }, 1500);
  };

  const tabSize =
    language === 'typescript' || language === 'javascript' ? 2 : 4;

  return (
    <div className="flex h-full min-h-[380px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Code2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <label htmlFor="editor-language-select" className="sr-only">
            Programming language
          </label>
          <select
            id="editor-language-select"
            aria-label="Programming language"
            value={language}
            disabled={readOnly}
            onChange={(e) =>
              onLanguageChange(e.target.value as SupportedLanguage)
            }
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
          >
            {selectableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>

          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {isModifiedFromStarter
              ? 'Draft Saved'
              : hasBackendStarter
              ? 'Backend Starter'
              : 'Standard Template'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Format code"
            disabled={readOnly || !code.trim()}
            onClick={handleFormatCode}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            {justFormatted ? (
              <>
                <Check
                  className="h-3 w-3 text-emerald-600"
                  aria-hidden="true"
                />
                <span>Formatted</span>
              </>
            ) : (
              <>
                <Wand2 className="h-3 w-3 text-blue-600" aria-hidden="true" />
                <span>Format</span>
              </>
            )}
          </button>

          <button
            type="button"
            aria-label={
              editorTheme === 'light'
                ? 'Switch editor to dark theme'
                : 'Switch editor to light theme'
            }
            onClick={() =>
              setEditorTheme((prev) =>
                prev === 'light' ? 'vs-dark' : 'light'
              )
            }
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {editorTheme === 'light' ? (
              <Moon className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Sun className="h-3 w-3" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {editorTheme === 'light' ? 'Dark' : 'Light'}
            </span>
          </button>

          <label htmlFor="editor-font-size" className="sr-only">
            Editor font size
          </label>
          <select
            id="editor-font-size"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-blue-600 focus:outline-none"
          >
            <option value={12}>12px</option>
            <option value={14}>14px</option>
            <option value={16}>16px</option>
          </select>

          {onResetStarterCode && (
            <button
              type="button"
              disabled={readOnly}
              onClick={onResetStarterCode}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor (with synchronous accessible textarea fallback in Vitest/jsdom) */}
      <div className="flex-1 min-h-[300px]">
        {isTestEnv ? (
          <textarea
            aria-label="Solution code editor"
            value={code}
            readOnly={readOnly}
            onChange={(e) => onCodeChange(e.target.value)}
            spellCheck={false}
            className="h-full min-h-[300px] w-full resize-none border-0 p-4 font-mono text-xs text-slate-900 focus:outline-none"
          />
        ) : (
          <Editor
            height="100%"
            language={MONACO_LANGUAGE_IDS[language]}
            value={code}
            theme={editorTheme}
            onMount={handleEditorMount}
            onChange={(nextValue) => onCodeChange(nextValue ?? '')}
            options={{
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize,
              insertSpaces: true,
              formatOnPaste: true,
              bracketPairColorization: { enabled: true },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              readOnly,
              padding: { top: 12, bottom: 12 },
              fontFamily:
                "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
            }}
          />
        )}
      </div>

      {/* Editor Status Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-3.5 py-1.5 text-[11px] text-slate-500">
        <span>
          Language:{' '}
          <strong className="font-semibold text-slate-700">
            {LANGUAGE_LABELS[language]}
          </strong>
        </span>
        <span className="font-mono tabular-nums">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'} &middot;{' '}
          {code.length} chars
        </span>
      </div>
    </div>
  );
}
