import { useState } from 'react';
import { ExecutionResult } from '../types';

interface OutputPanelProps {
  result: ExecutionResult | null;
  loading: boolean;
}

export function OutputPanel({ result, loading }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result?.result) return;
    const text = typeof result.result === 'object'
      ? JSON.stringify(result.result, null, 2)
      : String(result.result);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <div className="output-panel" id="output-panel">
        <div className="output-toolbar">
          <div className="editor-toolbar-left">
            <div className="terminal-window-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="output-label">Output</span>
          </div>
        </div>
        <div className="output-body">
          <div className="output-loading">
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Executing MongoDB query...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="output-panel" id="output-panel">
        <div className="output-toolbar">
          <div className="editor-toolbar-left">
            <div className="terminal-window-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="output-label">Output</span>
          </div>
        </div>
        <div className="output-body">
          <div className="output-empty">
            <div className="output-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <p className="output-empty-title">Ready for Execution</p>
            <span className="output-empty-sub">Write your query in the shell above and click <strong>Run</strong> or press <kbd>Ctrl+Enter</kbd></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="output-panel" id="output-panel">
      <div className="output-toolbar">
        <div className="editor-toolbar-left">
          <div className="terminal-window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="output-label">Output</span>
        </div>

        <div className="output-meta">
          {result.success && result.result !== null && result.result !== undefined && (
            <button
              type="button"
              className="btn-toolbar-action"
              onClick={handleCopy}
              title="Copy Output"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ color: 'var(--success)' }}>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy JSON
                </>
              )}
            </button>
          )}

          {result.success && result.documentCount !== undefined && (
            <span className="meta-badge doc-count">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {result.documentCount} doc{result.documentCount !== 1 ? 's' : ''}
            </span>
          )}

          <span className="meta-badge time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {result.executionTime}ms
          </span>
        </div>
      </div>

      <div className="output-body">
        {/* Status message */}
        {result.success && result.message && (
          <div className="output-message success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {result.message}
          </div>
        )}

        {/* Error message */}
        {!result.success && result.error && (
          <div className="output-message error">
            <div className="error-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              MongoDB Error
            </div>
            <p>{result.error}</p>
          </div>
        )}

        {/* Validation */}
        {result.validation && (
          <div className={`output-message validation ${result.validation.correct ? 'correct' : 'incorrect'}`}>
            {result.validation.message}
          </div>
        )}

        {/* Result JSON */}
        {result.success && result.result !== null && result.result !== undefined && (
          <pre className="output-json">
            {typeof result.result === 'object'
              ? JSON.stringify(result.result, null, 2)
              : String(result.result)}
          </pre>
        )}
      </div>
    </div>
  );
}
