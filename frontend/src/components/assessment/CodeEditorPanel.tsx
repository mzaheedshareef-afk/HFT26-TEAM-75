import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Code2, RotateCcw } from 'lucide-react';
import type { SupportedLanguage } from '../../types/assessment';

export const DEFAULT_STARTER_CODE: Record<SupportedLanguage, string> = {
  python: `import sys\n\ndef solve() -> None:\n    data = sys.stdin.read().strip().splitlines()\n    # Write your solution here\n\nif __name__ == "__main__":\n    solve()\n`,
  typescript: `import * as fs from 'fs';\n\nfunction solve(): void {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nsolve();\n`,
  javascript: `const fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nsolve();\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`,
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Write your solution here\n    return 0;\n}\n`,
};

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python 3.12',
  typescript: 'TypeScript',
  javascript: 'JavaScript (Node)',
  java: 'Java 21',
  cpp: 'C++ 20',
};

interface CodeEditorPanelProps {
  language: SupportedLanguage;
  allowedLanguages?: SupportedLanguage[];
  code: string;
  readOnly?: boolean;
  onLanguageChange: (language: SupportedLanguage) => void;
  onCodeChange: (code: string) => void;
  onResetStarterCode?: () => void;
}

export function CodeEditorPanel({
  language,
  allowedLanguages = ['python', 'typescript', 'javascript', 'java', 'cpp'],
  code,
  readOnly = false,
  onLanguageChange,
  onCodeChange,
  onResetStarterCode,
}: CodeEditorPanelProps) {
  const [fontSize, setFontSize] = useState(14);
  const isTestEnv = import.meta.env.MODE === 'test';

  return (
    <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Code2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <label htmlFor="editor-language-select" className="sr-only">
            Programming language
          </label>
          <select
            id="editor-language-select"
            value={language}
            disabled={readOnly}
            onChange={(e) =>
              onLanguageChange(e.target.value as SupportedLanguage)
            }
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
          >
            {allowedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
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
            language={language}
            value={code}
            theme="light"
            onChange={(nextValue) => onCodeChange(nextValue ?? '')}
            options={{
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              readOnly,
              padding: { top: 12, bottom: 12 },
              fontFamily:
                "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
            }}
          />
        )}
      </div>
    </div>
  );
}
