import { useRef, useCallback, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface MongoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  theme: 'dark' | 'light';
  loading: boolean;
}

const SNIPPETS = [
  { label: 'find()', code: 'db.users.find()' },
  { label: 'findOne()', code: 'db.users.findOne()' },
  { label: 'insertOne()', code: 'db.users.insertOne({\n  name: "John Doe",\n  role: "Developer",\n  active: true\n})' },
  { label: 'updateOne()', code: 'db.users.updateOne(\n  { name: "John Doe" },\n  { $set: { status: "verified" } }\n)' },
  { label: 'aggregate()', code: 'db.users.aggregate([\n  { $match: { active: true } },\n  { $count: "activeUsers" }\n])' },
  { label: 'stats()', code: 'db.stats()' },
];

export function MongoEditor({ value, onChange, onRun, onClear, theme, loading }: MongoEditorProps) {
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Define Custom MongoDB Shell Dark Theme
    monaco.editor.defineTheme('mongo-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00ed64', fontStyle: 'bold' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'e5c07b' },
        { token: 'delimiter', foreground: 'abb2bf' },
        { token: 'identifier', foreground: '61afef' },
        { token: 'type', foreground: 'e06c75' },
      ],
      colors: {
        'editor.background': '#070b12',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#0d1524',
        'editorLineNumber.foreground': '#384459',
        'editorLineNumber.activeForeground': '#00ed64',
        'editor.selectionBackground': '#1b3a5c',
        'editorCursor.foreground': '#00ed64',
        'editor.inactiveSelectionBackground': '#102238',
        'editorBracketMatch.background': '#00ed6433',
        'editorBracketMatch.border': '#00ed6488',
      },
    });

    monaco.editor.defineTheme('mongo-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00873d', fontStyle: 'bold' },
        { token: 'string', foreground: '032f62' },
        { token: 'number', foreground: '005cc5' },
        { token: 'identifier', foreground: '24292e' },
      ],
      colors: {
        'editor.background': '#f8fafc',
        'editor.foreground': '#1f2328',
        'editor.lineHighlightBackground': '#f1f5f9',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#0f172a',
        'editor.selectionBackground': '#bae6fd',
        'editorCursor.foreground': '#0284c7',
      },
    });

    monaco.editor.setTheme(theme === 'dark' ? 'mongo-dark' : 'mongo-light');

    // Add Ctrl+Enter keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });

    editor.focus();
  }, [theme, onRun]);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const lineCount = value.split('\n').length;
  const charCount = value.length;

  return (
    <div className="editor-panel" id="mongo-editor-panel">
      {/* Top Main Shell Header */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <div className="terminal-window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>

          <div className="shell-title-group">
            <div className="shell-icon-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
            <span className="shell-title">mongosh</span>
            <span className="shell-status-live" title="Live MongoDB Atlas Sandbox">
              <span className="live-ping" />
              Atlas Live
            </span>
          </div>
        </div>

        <div className="editor-toolbar-right">
          <button
            type="button"
            className="btn-toolbar-action"
            onClick={handleFormat}
            title="Format Document (Beautify)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18M3 12h18M6.3 6.3l11.4 11.4M6.3 17.7L17.7 6.3" />
            </svg>
            Format
          </button>

          <button
            type="button"
            className="btn-toolbar-action"
            onClick={handleCopy}
            title="Copy Shell Code"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: 'var(--success)' }}>Copied!</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>

          <button className="btn-clear" onClick={onClear} title="Clear editor" id="clear-editor">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear
          </button>

          <button
            className="btn-run"
            onClick={onRun}
            disabled={loading}
            title="Execute on Atlas (Ctrl+Enter)"
            id="run-query"
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            <span>{loading ? 'Running...' : 'Run'}</span>
            <kbd className="btn-run-kbd">Ctrl+↵</kbd>
          </button>
        </div>
      </div>

      {/* Quick Snippet Chips Bar */}
      <div className="editor-snippets-bar">
        <span className="snippets-label">⚡ Quick Snippets:</span>
        <div className="snippets-list">
          {SNIPPETS.map((snip) => (
            <button
              key={snip.label}
              type="button"
              className="snippet-chip"
              onClick={() => onChange(snip.code)}
              title={`Load snippet: ${snip.label}`}
            >
              {snip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Monaco Code Editor */}
      <div className="editor-container">
        <Editor
          height="100%"
          language="javascript"
          value={value}
          onChange={(v) => onChange(v || '')}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'mongo-dark' : 'mongo-light'}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 14, bottom: 14 },
            suggestOnTriggerCharacters: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            roundedSelection: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Futuristic Status Bar */}
      <div className="editor-footer">
        <div className="footer-left">
          <span className="footer-status-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Atlas Sandbox
          </span>
          <span className="editor-hint">Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to execute</span>
        </div>

        <div className="footer-right">
          <span className="footer-meta-item">Ln {lineCount}, Col {charCount}</span>
          <span className="footer-mode-tag">mongosh (JS)</span>
        </div>
      </div>
    </div>
  );
}
