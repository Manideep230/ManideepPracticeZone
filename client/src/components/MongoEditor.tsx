import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface MongoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  theme: 'dark' | 'light';
  loading: boolean;
}

export function MongoEditor({ value, onChange, onRun, onClear, theme, loading }: MongoEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Define MongoDB theme
    monaco.editor.defineTheme('mongo-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'delimiter', foreground: 'd4d4d4' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#8b949e',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#58a6ff',
        'editor.inactiveSelectionBackground': '#1c3050',
      },
    });

    monaco.editor.defineTheme('mongo-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a737d' },
        { token: 'keyword', foreground: 'd73a49' },
        { token: 'string', foreground: '032f62' },
        { token: 'number', foreground: '005cc5' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2328',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editorLineNumber.foreground': '#8b949e',
        'editorLineNumber.activeForeground': '#1f2328',
        'editor.selectionBackground': '#b6d7ff',
        'editorCursor.foreground': '#0969da',
      },
    });

    monaco.editor.setTheme(theme === 'dark' ? 'mongo-dark' : 'mongo-light');

    // Add Ctrl+Enter keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });

    editor.focus();
  }, [theme, onRun]);

  return (
    <div className="editor-panel" id="mongo-editor-panel">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <span className="editor-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            MongoDB Shell
          </span>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn-clear" onClick={onClear} title="Clear editor" id="clear-editor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear
          </button>
          <button
            className="btn-run"
            onClick={onRun}
            disabled={loading}
            title="Run query (Ctrl+Enter)"
            id="run-query"
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
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
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>
      <div className="editor-footer">
        <span className="editor-hint">Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run</span>
      </div>
    </div>
  );
}
